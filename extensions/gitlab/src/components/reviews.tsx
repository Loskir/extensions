import { ActionPanel, List, showToast, ToastStyle, Color, ImageLike } from "@raycast/api";
import { MergeRequest } from "../gitlabapi";
import { GitLabIcons } from "../icons";
import { gitlab } from "../common";
import { useState, useEffect } from "react";
import { getErrorMessage } from "../utils";
import { DefaultActions, GitLabOpenInBrowserAction } from "./actions";
import { ShowReviewMRAction } from "./review_actions";
import { useCache } from "../cache";
import { CommitStatus } from "./commits/list";
import { getCommitStatus } from "./commits/item";
import { getCIJobStatusIcon } from "./jobs";

export function ReviewList(): JSX.Element {
  const [searchText, setSearchText] = useState<string>();
  const { mrs, error, isLoading } = useSearch(searchText);

  if (error) {
    showToast(ToastStyle.Failure, "Cannot search Reviews", error);
  }

  if (!mrs) {
    return <List isLoading={true} searchBarPlaceholder="Loading" />;
  }

  return (
    <List
      searchBarPlaceholder="Filter Reviews by name..."
      onSearchTextChange={setSearchText}
      isLoading={isLoading}
      throttle={true}
    >
      {mrs?.map((mr) => (
        <ReviewListItem key={mr.id} mr={mr} />
      ))}
    </List>
  );
}

function ReviewListItem(props: { mr: MergeRequest }) {
  const mr = props.mr;
  const { data: status } = useCache<CommitStatus | undefined>(
    `project_commit_status_${mr.project_id}_${mr.sha}`,
    async (): Promise<CommitStatus | undefined> => {
      if (mr.sha) {
        return await getCommitStatus(mr.project_id, mr.sha);
      }
      return undefined;
    },
    {
      deps: [mr.sha, mr.project_id],
      secondsToRefetch: 30,
    }
  );
  const statusIcon: ImageLike | undefined = status?.status ? getCIJobStatusIcon(status.status) : undefined;
  return (
    <List.Item
      id={mr.id.toString()}
      title={mr.title}
      subtitle={"#" + mr.iid}
      icon={{ source: GitLabIcons.mropen, tintColor: Color.Green }}
      accessoryIcon={statusIcon}
      actions={
        <ActionPanel>
          <DefaultActions
            action={<ShowReviewMRAction mr={mr} />}
            webAction={<GitLabOpenInBrowserAction url={mr.web_url} />}
          />
        </ActionPanel>
      }
    />
  );
}

export function useSearch(query: string | undefined): {
  mrs?: MergeRequest[];
  error?: string;
  isLoading: boolean;
} {
  const [mrs, setMRs] = useState<MergeRequest[]>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // FIXME In the future version, we don't need didUnmount checking
    // https://github.com/facebook/react/pull/22114
    let didUnmount = false;

    async function fetchData() {
      if (query === null || didUnmount) {
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        const user = await gitlab.getMyself();
        const glMRs = await gitlab.getMergeRequests({
          state: "opened",
          reviewer_id: user.id,
          search: query || "",
          in: "title",
          scope: "all",
        });

        if (!didUnmount) {
          setMRs(glMRs);
        }
      } catch (e) {
        if (!didUnmount) {
          setError(getErrorMessage(e));
        }
      } finally {
        if (!didUnmount) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      didUnmount = true;
    };
  }, [query]);

  return { mrs, error, isLoading };
}
