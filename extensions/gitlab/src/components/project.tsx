import {
  ActionPanel,
  CopyToClipboardAction,
  List,
  OpenInBrowserAction,
  showToast,
  ToastStyle,
  PushAction,
  Color,
} from "@raycast/api";
import { useState } from "react";
import { gitlab, gitlabgql } from "../common";
import { Project, searchData } from "../gitlabapi";
import { hashRecord, projectIconUrl } from "../utils";
import { PipelineList } from "./pipelines";
import { BranchList } from "./branch";
import { MilestoneList } from "./milestones";
import { MRList, MRScope } from "./mr";
import { IssueList, IssueScope } from "./issues";
import { CloneProjectInGitPod, CloneProjectInVSCodeAction, ShowProjectLabels } from "./project_actions";
import { GitLabIcons, useImage } from "../icons";
import { useCache } from "../cache";
import { ClearLocalCacheAction } from "./cache_actions";

function webUrl(project: Project, partial: string) {
  return gitlabgql.urlJoin(`${project.fullPath}/${partial}`);
}

function getProjectActions(project: Project) {
  return [
    <PushAction
      title="Issues"
      shortcut={{ modifiers: ["cmd"], key: "i" }}
      icon={{ source: GitLabIcons.issue, tintColor: Color.PrimaryText }}
      target={<IssueList scope={IssueScope.all} project={project} />}
      key="issues"
    />,
    <PushAction
      title="Merge Requests"
      shortcut={{ modifiers: ["cmd"], key: "m" }}
      icon={{ source: GitLabIcons.merge_request, tintColor: Color.PrimaryText }}
      target={<MRList scope={MRScope.all} project={project} />}
      key="mr"
    />,
    <PushAction
      title="Branches"
      shortcut={{ modifiers: ["cmd"], key: "b" }}
      icon={{ source: GitLabIcons.branches, tintColor: Color.PrimaryText }}
      target={<BranchList project={project} />}
      key="branches"
    />,
    <PushAction
      title="Pipelines"
      shortcut={{ modifiers: ["cmd"], key: "p" }}
      icon={{ source: GitLabIcons.ci, tintColor: Color.PrimaryText }}
      target={<PipelineList projectFullPath={project.fullPath} />}
      key="pipelines"
    />,
    <PushAction
      title="Milestones"
      shortcut={{ modifiers: ["cmd"], key: "s" }}
      icon={{ source: GitLabIcons.milestone, tintColor: Color.PrimaryText }}
      target={<MilestoneList project={project} />}
      key="milestones"
    />,
    <ShowProjectLabels project={project} shortcut={{ modifiers: ["cmd"], key: "l" }} key="labels" />,
  ];
}

export function ProjectListItem(props: { project: Project }): JSX.Element {
  const project = props.project;
  const {
    localFilepath: localImageFilepath,
    error,
    isLoading,
  } = useImage(projectIconUrl(project), GitLabIcons.project);

  return (
    <List.Item
      id={project.id.toString()}
      title={project.name_with_namespace}
      subtitle={"Stars " + project.star_count}
      icon={localImageFilepath}
      actions={
        <ActionPanel>
          <ActionPanel.Section title={project.name_with_namespace}>
            <PushAction title="Open Project" target={<ProjectScreen project={project} />} />
            <OpenInBrowserAction url={project.web_url} />
            <CopyToClipboardAction title="Copy Project ID" content={project.id} />
          </ActionPanel.Section>
          <ActionPanel.Section>{...getProjectActions(project)}</ActionPanel.Section>
          <ActionPanel.Section title="Open in Browser">
            <OpenInBrowserAction
              title="Labels"
              icon={{ source: GitLabIcons.labels, tintColor: Color.PrimaryText }}
              url={webUrl(project, "-/labels")}
            />
            <OpenInBrowserAction
              title="Security & Compliance"
              icon={{ source: GitLabIcons.security, tintColor: Color.PrimaryText }}
              url={webUrl(project, "-/security/discover")}
            />
            <OpenInBrowserAction
              title="Settings"
              icon={{ source: GitLabIcons.settings, tintColor: Color.PrimaryText }}
              url={webUrl(project, "edit")}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="IDE">
            <CloneProjectInVSCodeAction shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} project={project} />
            <CloneProjectInGitPod shortcut={{ modifiers: ["cmd", "shift"], key: "g" }} project={project} />
          </ActionPanel.Section>
          <ActionPanel.Section title="Cache">
            <ClearLocalCacheAction />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

interface ProjectListProps {
  membership?: boolean;
  starred?: boolean;
}

export function ProjectList({ membership = true, starred = false }: ProjectListProps): JSX.Element {
  const [searchText, setSearchText] = useState<string>();
  const { data, error, isLoading } = useCache<Project[]>(
    hashRecord({ membership: membership, starred: starred }, "projects"),
    async () => {
      let glProjects: Project[] = [];
      if (starred) {
        glProjects = await gitlab.getStarredProjects({ searchText: "", searchIn: "name" }, true);
      } else {
        if (membership) {
          glProjects = await gitlab.getUserProjects({ search: "" }, true);
        }
      }
      return glProjects;
    },
    {
      deps: [searchText, membership, starred],
      onFilter: async (projects) => {
        return await searchData<Project[]>(projects, {
          search: searchText || "",
          keys: ["name_with_namespace"],
          limit: 50,
        });
      },
    }
  );

  if (error) {
    showToast(ToastStyle.Failure, "Cannot search Project", error);
  }

  if (!data) {
    return <List isLoading={true} searchBarPlaceholder="Loading" />;
  }

  return (
    <List
      searchBarPlaceholder="Filter Projects by name..."
      onSearchTextChange={setSearchText}
      isLoading={isLoading}
      throttle={true}
    >
      {data?.map((project) => (
        <ProjectListItem key={project.id} project={project} />
      ))}
    </List>
  );
}

export function ProjectScreen({ project }: { project: Project }): JSX.Element {
  function ProjectActions({ children }: { children?: JSX.Element }): JSX.Element {
    return (
      <ActionPanel>
        {children}
        <ActionPanel.Section title="Project">{...getProjectActions(project)}</ActionPanel.Section>
        <ActionPanel.Section title="Open in Browser">
          <OpenInBrowserAction
            title="Labels"
            icon={{ source: GitLabIcons.labels, tintColor: Color.PrimaryText }}
            url={webUrl(project, "-/labels")}
          />
          <OpenInBrowserAction
            title="Security & Compliance"
            icon={{ source: GitLabIcons.security, tintColor: Color.PrimaryText }}
            url={webUrl(project, "-/security/discover")}
          />
          <OpenInBrowserAction
            title="Settings"
            icon={{ source: GitLabIcons.settings, tintColor: Color.PrimaryText }}
            url={webUrl(project, "edit")}
          />
        </ActionPanel.Section>
        <ActionPanel.Section title="IDE">
          <CloneProjectInVSCodeAction shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} project={project} />
          <CloneProjectInGitPod shortcut={{ modifiers: ["cmd", "shift"], key: "g" }} project={project} />
        </ActionPanel.Section>
        <ActionPanel.Section title="Cache">
          <ClearLocalCacheAction />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }

  const listIconColor = Color.Green;

  return (
    <List
      searchBarPlaceholder="Search"
      // onSearchTextChange={setSearchText}
      // isLoading={isLoading}
      // throttle={true}
      navigationTitle={`Project ${project.fullPath}`}
    >
      <List.Item
        title="Issues"
        key="issues"
        icon={{ source: GitLabIcons.issue, tintColor: listIconColor }}
        actions={
          <ProjectActions>
            <ActionPanel.Section>
              <PushAction
                title="Open Issues"
                icon={{ source: GitLabIcons.issue, tintColor: Color.PrimaryText }}
                target={<IssueList scope={IssueScope.all} project={project} />}
              />
            </ActionPanel.Section>
          </ProjectActions>
        }
      />
      <List.Item
        title="Merge Requests"
        key="merge_requests"
        icon={{ source: GitLabIcons.merge_request, tintColor: listIconColor }}
        actions={
          <ProjectActions>
            <ActionPanel.Section>
              <PushAction
                title="Open Merge Requests"
                icon={{ source: GitLabIcons.merge_request, tintColor: Color.PrimaryText }}
                target={<MRList scope={MRScope.all} project={project} />}
              />
            </ActionPanel.Section>
          </ProjectActions>
        }
      />
      <List.Item
        title="Branches"
        key="branches"
        icon={{ source: GitLabIcons.branches, tintColor: listIconColor }}
        actions={
          <ProjectActions>
            <ActionPanel.Section>
              <PushAction
                title="Open Branches"
                icon={{ source: GitLabIcons.branches, tintColor: Color.PrimaryText }}
                target={<BranchList project={project} />}
              />
            </ActionPanel.Section>
          </ProjectActions>
        }
      />
      <List.Item
        title="Pipelines"
        key="pipelines"
        icon={{ source: GitLabIcons.ci, tintColor: listIconColor }}
        actions={
          <ProjectActions>
            <ActionPanel.Section>
              <PushAction
                title="Open Pipelines"
                icon={{ source: GitLabIcons.ci, tintColor: Color.PrimaryText }}
                target={<PipelineList projectFullPath={project.fullPath} />}
              />
            </ActionPanel.Section>
          </ProjectActions>
        }
      />
      <List.Item
        title="Milestones"
        key="milestones"
        icon={{ source: GitLabIcons.milestone, tintColor: listIconColor }}
        actions={
          <ProjectActions>
            <ActionPanel.Section>
              <PushAction
                title="Open Milestones"
                icon={{ source: GitLabIcons.milestone, tintColor: Color.PrimaryText }}
                target={<MilestoneList project={project} />}
              />
            </ActionPanel.Section>
          </ProjectActions>
        }
      />
    </List>
  );
}
