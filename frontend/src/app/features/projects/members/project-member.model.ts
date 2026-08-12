/**
 * Project member domain models (spec: project-members-ui; design D8, D2).
 * Mirror the backend's ProjectMemberResponse / ProjectMemberAddRequest /
 * ProjectMemberRoleUpdateRequest shapes (ProjectMemberController,
 * dto/ProjectMemberResponse.java, dto/ProjectMemberAddRequest.java,
 * dto/ProjectMemberRoleUpdateRequest.java) and the ProjectRole enum, already
 * mirrored verbatim in `features/admin-permissions/role-permission.model.ts`.
 * Re-declared here rather than imported (design D8): cross-feature imports
 * between sibling feature folders are not an established pattern in this
 * codebase.
 */
export type ProjectRole =
  | 'PRODUCT_OWNER'
  | 'PROJECT_MANAGER'
  | 'DEVELOPER'
  | 'UX_UI_DESIGNER'
  | 'QA'
  | 'DEVOPS';

export interface ProjectMember {
  id: number;
  projectId: number;
  userId: number;
  role: ProjectRole;
  joinedAt: string;
}

export interface ProjectMemberAddRequest {
  userId: number;
  role: ProjectRole;
}

export interface ProjectMemberRoleUpdateRequest {
  role: ProjectRole;
}

/** Single source of truth for role `<option>` labels (design D8). */
export const PROJECT_ROLE_OPTIONS: ReadonlyArray<{ value: ProjectRole; label: string }> = [
  { value: 'PRODUCT_OWNER', label: 'Product Owner' },
  { value: 'PROJECT_MANAGER', label: 'Project Manager' },
  { value: 'DEVELOPER', label: 'Desarrollador' },
  { value: 'UX_UI_DESIGNER', label: 'Diseñador UX-UI' },
  { value: 'QA', label: 'QA' },
  { value: 'DEVOPS', label: 'DevOps' },
];
