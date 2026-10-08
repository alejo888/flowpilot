package com.flowpilot.service;

import com.flowpilot.entity.GlobalRole;
import com.flowpilot.entity.Permission;
import com.flowpilot.entity.Project;
import com.flowpilot.entity.ProjectMember;
import com.flowpilot.entity.ProjectRole;
import com.flowpilot.entity.RolePermission;
import com.flowpilot.entity.User;
import com.flowpilot.exception.ProjectNotFoundException;
import com.flowpilot.exception.UserNotFoundException;
import com.flowpilot.repository.ProjectMemberRepository;
import com.flowpilot.repository.ProjectRepository;
import com.flowpilot.repository.RolePermissionRepository;
import com.flowpilot.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import java.util.Collection;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

/**
 * Matrix-backed authorization seam for project-scoped writes (spec:
 * role-permissions; design's {@code ProjectAuthorizationService}
 * pseudocode, all 4 steps — supersedes the slices-3-through-6 interim
 * {@code isOwnerOrAdmin}/{@code canManageWorkItems} owner-or-admin rule):
 *
 * <ol>
 *   <li>A deactivated caller ({@code !user.isActive()}) is denied outright,
 *       before any of the branches below — an already-issued access token must
 *       not outlive the deactivation for project-scoped reads or writes.</li>
 *   <li>Global admin ({@link GlobalRole#ADMINISTRADOR}) bypasses everything —
 *       decision 6, matrix-independent, never restrictable.</li>
 *   <li>The project's owner bypasses everything — decision 5c, self-lockout
 *       guard.</li>
 *   <li>Live {@link ProjectMember} lookup (never cached; a role change via
 *       {@code PUT /api/projects/{id}/members/{userId}} takes effect on the
 *       very next request). No membership denies.</li>
 *   <li>{@code role_permissions} matrix cache lookup for the member's role.</li>
 * </ol>
 *
 * <p>{@link #hasPermission} is the single general-purpose seam (design D5).
 * {@code ProjectService}/{@code ProjectMemberService}/{@code
 * WorkItemService}/{@code BoardService} call it with the specific {@link
 * Permission} their operation guards (per the proposal's Permission Catalog
 * table) instead of the old collapsed owner-or-admin/any-member checks —
 * granularity is the entire point of decision 5b (e.g. an admin can grant
 * {@code MEMBER_ADD} to Developer without also granting {@code
 * PROJECT_DELETE}).
 *
 * <p>The matrix itself is cached in-process as a {@link
 * #grants} {@code EnumMap<ProjectRole, EnumSet<Permission>>} (design D5),
 * loaded once at startup ({@link #loadCache()}) and rebuilt wholesale by
 * {@link #reloadCache()} — package-private, called after any write to
 * {@code role_permissions} (slice 8b's admin write endpoint). Never issues a
 * {@code role_permissions} query per authorization check.
 *
 * <p>{@link #canView} implements design's read-gate ({@code canRead = admin
 * || owner || member}) and is unaffected by the matrix — reads stay
 * membership-based, not permission-gated (proposal: "Reads are NOT
 * permission-gated in MVP").
 */
@Service
public class ProjectAuthorizationService {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final RolePermissionRepository rolePermissionRepository;

    private volatile Map<ProjectRole, EnumSet<Permission>> grants = new EnumMap<>(ProjectRole.class);

    public ProjectAuthorizationService(
            UserRepository userRepository,
            ProjectRepository projectRepository,
            ProjectMemberRepository projectMemberRepository,
            RolePermissionRepository rolePermissionRepository) {
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.rolePermissionRepository = rolePermissionRepository;
    }

    @PostConstruct
    void loadCache() {
        reloadCache();
    }

    /**
     * Design's {@code hasPermission(userId, projectId, permission)} pseudocode,
     * all 4 steps.
     */
    public boolean hasPermission(Long userId, Long projectId, Permission permission) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        if (!user.isActive()) {
            return false; // step 0 — a deactivated caller is denied on every branch
        }
        if (user.getRole() == GlobalRole.ADMINISTRADOR) {
            return true; // step 1 — global admin, before any matrix touch
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));
        if (project.getOwnerId().equals(userId)) {
            return true; // step 2 — owner short-circuit, self-lockout guard
        }

        return projectMemberRepository.findByProjectIdAndUserId(projectId, userId) // step 3 — live read, no cache
                .map(ProjectMember::getRole)
                .map(role -> grants.getOrDefault(role, EnumSet.noneOf(Permission.class)).contains(permission))
                .orElse(false); // step 4 (via the map lookup) — no membership denies
    }

    /**
     * Returns the full set of {@link Permission}s the caller holds for this
     * project, computed with the SAME lookup chain as {@link #hasPermission}
     * but performed once instead of once per permission. Deactivated caller
     * -> empty set; global admin or project owner -> every permission
     * (matches steps 0-2 of {@link #hasPermission}); otherwise the
     * matrix-granted set for the caller's live {@link ProjectMember} role, or
     * an empty set when the caller is not a member.
     */
    public EnumSet<Permission> permissionsFor(Long userId, Long projectId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        return decidePermissions(
                user,
                () -> projectRepository.findById(projectId)
                        .orElseThrow(() -> new ProjectNotFoundException(projectId)),
                () -> projectMemberRepository.findByProjectIdAndUserId(projectId, userId)
                        .map(ProjectMember::getRole)
                        .orElse(null));
    }

    /**
     * Same decision as {@link #permissionsFor(Long, Long)}, over data the
     * caller already loaded: {@code memberRole} is the caller's live
     * membership role in {@code project}, or {@code null} when not a member.
     */
    public EnumSet<Permission> permissionsFor(User caller, Project project, ProjectRole memberRole) {
        return decidePermissions(caller, () -> project, () -> memberRole);
    }

    /**
     * {@link #permissionsFor(Long, Long)} for many projects at once, keyed by
     * project id: the caller's memberships across all of them are loaded in
     * ONE query, and only if some project actually reaches the membership
     * step (a deactivated caller or a global admin issues no query at all).
     */
    public Map<Long, EnumSet<Permission>> permissionsForProjects(User caller, Collection<Project> projects) {
        List<Long> projectIds = projects.stream().map(Project::getId).toList();
        var memberships = new Object() {
            private Map<Long, ProjectRole> roles;

            ProjectRole roleIn(Long projectId) {
                if (roles == null) {
                    roles = new HashMap<>();
                    projectMemberRepository.findByUserIdAndProjectIdIn(caller.getId(), projectIds)
                            .forEach(member -> roles.put(member.getProjectId(), member.getRole()));
                }
                return roles.get(projectId);
            }
        };
        Map<Long, EnumSet<Permission>> result = new LinkedHashMap<>();
        for (Project project : projects) {
            result.put(project.getId(),
                    decidePermissions(caller, () -> project, () -> memberships.roleIn(project.getId())));
        }
        return result;
    }

    /**
     * The single permission-set rule chain (steps 0-4 of {@link
     * #hasPermission}). The project and the membership role are suppliers so
     * each is only resolved when its step is reached — a deactivated caller or
     * a global admin never needs either, and an owner never needs the role.
     */
    private EnumSet<Permission> decidePermissions(
            User caller, Supplier<Project> project, Supplier<ProjectRole> memberRole) {
        if (!caller.isActive()) {
            return EnumSet.noneOf(Permission.class);
        }
        if (caller.getRole() == GlobalRole.ADMINISTRADOR) {
            return EnumSet.allOf(Permission.class);
        }
        if (project.get().getOwnerId().equals(caller.getId())) {
            return EnumSet.allOf(Permission.class);
        }
        ProjectRole role = memberRole.get();
        if (role == null) {
            return EnumSet.noneOf(Permission.class);
        }
        return EnumSet.copyOf(grants.getOrDefault(role, EnumSet.noneOf(Permission.class)));
    }

    /**
     * Read gate: admin OR owner OR a live {@code ProjectMember} of the
     * project (design's {@code canRead} formula). Unaffected by slice 8a.
     */
    public boolean canView(Long userId, Long projectId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(userId));
        if (!user.isActive()) {
            return false; // a deactivated caller is denied on every branch
        }
        if (user.getRole() == GlobalRole.ADMINISTRADOR) {
            return true;
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new ProjectNotFoundException(projectId));
        if (project.getOwnerId().equals(userId)) {
            return true;
        }

        return projectMemberRepository.existsByProjectIdAndUserId(projectId, userId);
    }

    /**
     * Evicts and wholesale-rebuilds the in-process {@link #grants} cache from
     * {@code role_permissions}. Package-private: called once at startup
     * ({@link #loadCache()}) and, from slice 8b onward, after any bulk write
     * to the matrix so the new grants take effect immediately with no
     * restart (single-node MVP — design D5's documented multi-instance
     * caveat).
     */
    void reloadCache() {
        Map<ProjectRole, EnumSet<Permission>> fresh = new EnumMap<>(ProjectRole.class);
        for (ProjectRole role : ProjectRole.values()) {
            fresh.put(role, EnumSet.noneOf(Permission.class));
        }
        for (RolePermission rolePermission : rolePermissionRepository.findAll()) {
            if (rolePermission.isGranted()) {
                fresh.get(rolePermission.getRole()).add(rolePermission.getPermission());
            }
        }
        this.grants = fresh;
    }
}
