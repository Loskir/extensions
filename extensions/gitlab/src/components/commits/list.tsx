import { Color, List, showToast, ToastStyle } from "@raycast/api";
import { useCache } from "../../cache";
import { gitlab } from "../../common";
import { Project } from "../../gitlabapi";
import { GitLabIcons } from "../../icons";
import { Event } from "../event";

function CommitListItem(props: { event: Event }): JSX.Element {
  const e = props.event;
  const commit = e.push_data?.commit_to;
  const ref = e.push_data?.ref;
  const title = e.push_data?.commit_title || "no title";
  const { data: project } = useCache<Project | undefined>(
    `event_project_${e.project_id}`,
    async (): Promise<Project | undefined> => {
      const pro = await gitlab.getProject(e.project_id);
      return pro;
    },
    {
      deps: [e.project_id],
      secondsToRefetch: 15 * 60,
    }
  );
  return (
    <List.Item
      title={title}
      subtitle={ref || commit}
      accessoryTitle={project?.name_with_namespace}
      icon={{ source: GitLabIcons.branches, tintColor: Color.Green }}
    />
  );
}

export function RecentCommitsList(): JSX.Element {
  const { data, error, isLoading } = useCache<Event[]>(
    "events_pushed",
    async (): Promise<Event[]> => {
      const events: Event[] = await gitlab.fetch("events", { action: "pushed" }).then((d) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return d.map((ev: any) => ev as Event);
      });
      const result = events.filter((e) => e.action_name === "pushed to" || e.action_name === "pushed new");
      return result;
    },
    {
      deps: [],
      secondsToRefetch: 5,
    }
  );
  if (error) {
    showToast(ToastStyle.Failure, "Could not fetch events", error);
  }
  return (
    <List isLoading={isLoading}>
      {data?.map((e) => (
        <CommitListItem event={e} key={`${e.target_id}${e.project_id}`} />
      ))}
    </List>
  );
}
