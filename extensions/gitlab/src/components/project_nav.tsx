import { ActionPanel, Color, ImageLike, KeyboardShortcut, List, PushAction } from "@raycast/api";
import { Project } from "../gitlabapi";
import { gitlabgql } from "../common";
import { ReactNode } from "react";
import { PipelineList } from "./pipelines";
import { BranchList } from "./branch";
import { MilestoneList } from "./milestones";
import { MRList, MRScope } from "./mr";
import { IssueList, IssueScope } from "./issues";
import { GitLabIcons } from "../icons";
import { GitLabOpenInBrowserAction } from "./actions";
import { ProjectLabelList } from "./project_label";
import { ProjectNavigationActions } from "./project_actions";

export function ProjectNavMenuItem(props: {
  title: string;
  shortcut?: KeyboardShortcut | undefined;
  target: ReactNode;
  icon?: ImageLike;
  project: Project;
}): JSX.Element {
  return (
    <List.Item
      title={props.title}
      icon={props.icon}
      actions={
        <ActionPanel>
          <PushAction title={`Open ${props.title}`} shortcut={props.shortcut} target={props.target} />
          <ActionPanel.Section>
            <ProjectNavigationActions project={props.project} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

export function ProjectNavMenuBrowserItem(props: {
  title: string;
  shortcut?: KeyboardShortcut | undefined;
  url: string;
  icon?: ImageLike;
}): JSX.Element {
  return (
    <List.Item
      title={props.title}
      icon={props.icon}
      actions={
        <ActionPanel>
          <GitLabOpenInBrowserAction url={props.url} shortcut={props.shortcut} />
        </ActionPanel>
      }
    />
  );
}

function webUrl(project: Project, partial: string) {
  return gitlabgql.urlJoin(`${project.fullPath}/${partial}`);
}

export function ProjectNavMenusList(props: { project: Project }): JSX.Element {
  const project = props.project;
  return (
    <List navigationTitle={`Project ${project.fullPath}`}>
      <List.Section>
        <ProjectNavMenuItem
          project={project}
          title="Issues"
          icon={{ source: GitLabIcons.issue, tintColor: Color.PrimaryText }}
          target={<IssueList scope={IssueScope.all} project={project} />}
        />
        <ProjectNavMenuItem
          project={project}
          title="Merge Requests"
          icon={{ source: GitLabIcons.merge_request, tintColor: Color.PrimaryText }}
          target={<MRList scope={MRScope.all} project={project} />}
        />
        <ProjectNavMenuItem
          project={project}
          title="Branches"
          icon={{ source: GitLabIcons.branches, tintColor: Color.PrimaryText }}
          target={<BranchList project={project} />}
        />
        <ProjectNavMenuItem
          project={project}
          title="Pipelines"
          icon={{ source: GitLabIcons.ci, tintColor: Color.PrimaryText }}
          target={<PipelineList projectFullPath={project.fullPath} />}
        />
        <ProjectNavMenuItem
          project={project}
          title="Milestones"
          icon={{ source: GitLabIcons.milestone, tintColor: Color.PrimaryText }}
          target={<MilestoneList project={project} />}
        />
        <ProjectNavMenuItem
          project={project}
          title="Labels"
          icon={{ source: GitLabIcons.labels, tintColor: Color.PrimaryText }}
          target={<ProjectLabelList project={project} />}
        />
      </List.Section>
      <List.Section title="Open in Browser">
        <ProjectNavMenuBrowserItem
          title="Security & Compliance"
          icon={{ source: GitLabIcons.security, tintColor: Color.PrimaryText }}
          url={webUrl(project, "-/security/discover")}
        />
        <ProjectNavMenuBrowserItem
          title="Settings"
          icon={{ source: GitLabIcons.settings, tintColor: Color.PrimaryText }}
          url={webUrl(project, "edit")}
        />
      </List.Section>
    </List>
  );
}
