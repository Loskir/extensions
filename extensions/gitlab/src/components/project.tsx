import { ActionPanel, CopyToClipboardAction, List, showToast, ToastStyle, Color } from "@raycast/api";
import { useState } from "react";
import { gitlab, gitlabgql } from "../common";
import { Project, searchData } from "../gitlabapi";
import { daysInSeconds, hashRecord, projectIconUrl } from "../utils";
import {
  CloneProjectInGitPod,
  CloneProjectInVSCodeAction,
  ProjectDefaultActions,
  ProjectNavigationActions,
} from "./project_actions";
import { GitLabIcons, useImage } from "../icons";
import { useCache } from "../cache";
import { ClearLocalCacheAction } from "./cache_actions";
import { GitLabOpenInBrowserAction } from "./actions";
import React from "react";

function webUrl(project: Project, partial: string) {
  return gitlabgql.urlJoin(`${project.fullPath}/${partial}`);
}

export function ProjectListItem(props: { project: Project }): JSX.Element {
  const project = props.project;
  const { localFilepath: localImageFilepath } = useImage(projectIconUrl(project), GitLabIcons.project);

  return (
    <List.Item
      id={project.id.toString()}
      title={project.name_with_namespace}
      subtitle={"Stars " + project.star_count}
      icon={localImageFilepath}
      actions={
        <ActionPanel>
          <ActionPanel.Section title={project.name_with_namespace}>
            <ProjectDefaultActions project={project} />
            <CopyToClipboardAction title="Copy Project ID" content={project.id} />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <ProjectNavigationActions project={project} />
          </ActionPanel.Section>
          <ActionPanel.Section title="Open in Browser">
            <GitLabOpenInBrowserAction
              title="Labels"
              icon={{ source: GitLabIcons.labels, tintColor: Color.PrimaryText }}
              url={webUrl(project, "-/labels")}
            />
            <GitLabOpenInBrowserAction
              title="Security & Compliance"
              icon={{ source: GitLabIcons.security, tintColor: Color.PrimaryText }}
              url={webUrl(project, "-/security/discover")}
            />
            <GitLabOpenInBrowserAction
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
      secondsToInvalid: daysInSeconds(7),
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
