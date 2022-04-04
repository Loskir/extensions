import { ActionPanel, List, Icon, Image, Color, showToast, Toast, Detail } from "@raycast/api";
import { useEffect, useState } from "react";
import { getCIJobRefreshInterval, gitlab, gitlabgql } from "../common";
import { gql } from "@apollo/client";
import { ensureCleanAccessories, getErrorMessage, getIdFromGqlId, now } from "../utils";
import { RefreshJobsAction } from "./job_actions";
import useInterval from "use-interval";
import { GitLabOpenInBrowserAction } from "./actions";
import { Project } from "../gitlabapi";
import { GitLabIcons } from "../icons";

export interface Job {
  id: string;
  name: string;
  status: string;
  duration: number | null;
}

export interface ApiJob {
  id: number;
  status: string;
  stage: string;
  name: string;
  ref: string;
  duration: number | null;
}

const GET_PIPELINE_JOBS = gql`
  query GetProjectPipelines($fullPath: ID!, $pipelineIID: ID!) {
    project(fullPath: $fullPath) {
      pipeline(iid: $pipelineIID) {
        stages {
          nodes {
            name
            jobs {
              nodes {
                id
                name
                status
                duration
              }
            }
          }
        }
      }
    }
  }
`;

export function getCIJobStatusIcon(status: string): Image {
  switch (status.toLowerCase()) {
    case "success": {
      return { source: GitLabIcons.status_success, tintColor: Color.Green };
    }
    case "created": {
      return { source: GitLabIcons.status_created, tintColor: Color.Yellow };
    }
    case "pending": {
      return { source: GitLabIcons.status_pending, tintColor: Color.Yellow };
    }
    case "running": {
      return { source: GitLabIcons.status_running, tintColor: Color.Blue };
    }
    case "failed": {
      return { source: GitLabIcons.status_failed, tintColor: Color.Red };
    }
    case "canceled": {
      return { source: GitLabIcons.status_canceled, tintColor: Color.PrimaryText };
    }
    case "skipped": {
      return { source: GitLabIcons.status_skipped, tintColor: "#868686" };
    }
    case "scheduled": {
      return { source: GitLabIcons.status_scheduled, tintColor: Color.Blue };
    }
    default:
      return { source: Icon.ExclamationMark, tintColor: Color.Magenta };
  }
  /*
  missing 
  * WAITING_FOR_RESOURCE
  * PREPARING
  * MANUAL
  */
}

export function getCIJobStatusEmoji(status: string): string {
  switch (status.toLowerCase()) {
    case "success": {
      return "✅";
    }
    case "created": {
      return "🔨";
    }
    case "pending": {
      return "⏰";
    }
    case "running": {
      return "🔄";
    }
    case "failed": {
      return "❌";
    }
    case "canceled": {
      return "🛑";
    }
    case "skipped": {
      return "➡️";
    }
    case "scheduled": {
      return "🕐";
    }
    case "manual": {
      return "👨‍💼";
    }
    default:
      console.log(status);
      return "💼";
  }
  /*
  missing 
  * WAITING_FOR_RESOURCE
  * PREPARING
  */
}

function getStatusText({ status, duration }: Job) {
  const s = status.toLowerCase();
  if (s === "success") {
    return `passed in ${duration}s`;
  }
  if (s === "running") {
    return `[${duration}s] ${s}`;
  }
  return s;
}

export function JobListItem(props: { job: Job; projectFullPath: string; onRefreshJobs: () => void }): JSX.Element {
  const job = props.job;
  const icon = getCIJobStatusIcon(job.status);
  const subtitle = "#" + getIdFromGqlId(job.id);
  const status = getStatusText(job);
  return (
    <List.Item
      id={job.id}
      icon={icon}
      title={job.name}
      subtitle={subtitle}
      accessories={ensureCleanAccessories([{ text: status }])}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <GitLabOpenInBrowserAction
              url={gitlabgql.urlJoin(`${props.projectFullPath}/-/jobs/${getIdFromGqlId(job.id)}`)}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <RefreshJobsAction onRefreshJobs={props.onRefreshJobs} />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function JobListRenderer(props: {
  isLoading: boolean;
  stages: Record<string, Job[]>;
  projectFullPath: string;
  onRefresh: () => void;
}): JSX.Element {
  return (
    <List isLoading={props.isLoading} navigationTitle="Jobs">
      {Object.keys(props.stages).map((stagekey) => (
        <List.Section key={stagekey} title={stagekey}>
          {props.stages[stagekey].map((job) => (
            <JobListItem
              job={job}
              projectFullPath={props.projectFullPath}
              onRefreshJobs={props.onRefresh}
              key={job.id}
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}

export function JobList(props: { projectFullPath: string; pipelineIID: string }): JSX.Element {
  const { stages, error, isLoading, refresh } = useSearch("", props.projectFullPath, props.pipelineIID);
  useInterval(() => {
    refresh();
  }, getCIJobRefreshInterval());
  if (error) {
    showToast(Toast.Style.Failure, "Cannot search Pipelines", error);
  }
  return (
    <JobListRenderer
      isLoading={isLoading}
      stages={stages}
      projectFullPath={props.projectFullPath}
      onRefresh={refresh}
    />
  );
}

export function JobListByPipelineId(props: {
  projectId: number;
  projectFullPath: string;
  pipelineId: number;
}): JSX.Element {
  console.log("render JobListByPipelineId");
  const { stages, error, isLoading, refresh } = useSearchByPipelineId("", props.projectId, props.pipelineId);
  useInterval(() => {
    refresh();
  }, getCIJobRefreshInterval());
  if (error) {
    showToast(Toast.Style.Failure, "Cannot search Pipelines", error);
  }
  return (
    <JobListRenderer
      isLoading={isLoading}
      stages={stages}
      projectFullPath={props.projectFullPath}
      onRefresh={refresh}
    />
  );
}

export function useSearch(
  query: string | undefined,
  projectFullPath: string,
  pipelineIID: string
): {
  stages: Record<string, Job[]>;
  error?: string;
  isLoading: boolean;
  refresh: () => void;
} {
  const [stages, setStages] = useState<Record<string, Job[]>>({});
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timestamp, setTimestamp] = useState<Date>(now());

  const refresh = () => {
    setTimestamp(now());
  };

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
        const data = await gitlabgql.client.query({
          query: GET_PIPELINE_JOBS,
          variables: { fullPath: projectFullPath, pipelineIID: pipelineIID },
          fetchPolicy: "network-only",
        });
        const stages: Record<string, Job[]> = {};
        for (const stage of data.data.project.pipeline.stages.nodes) {
          if (!stages[stage.name]) {
            stages[stage.name] = [];
          }
          for (const job of stage.jobs.nodes) {
            stages[stage.name].push({ id: job.id, name: job.name, status: job.status, duration: job.duration });
          }
        }
        if (!didUnmount) {
          setStages(stages);
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
  }, [query, projectFullPath, pipelineIID, timestamp]);

  return { stages, error, isLoading, refresh };
}

export function useSearchByPipelineId(
  query: string | undefined,
  projectId: number,
  pipelineId: number
): {
  stages: Record<string, Job[]>;
  error?: string;
  isLoading: boolean;
  refresh: () => void;
} {
  const [stages, setStages] = useState<Record<string, Job[]>>({});
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timestamp, setTimestamp] = useState<Date>(now());

  const refresh = () => {
    setTimestamp(now());
  };

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
        const glPipelineJobs = await gitlab
          .fetch(`projects/${projectId}/pipelines/${pipelineId}/jobs`)
          .then((data) => data as ApiJob[]);

        console.log(glPipelineJobs);

        const stages: Record<string, Job[]> = {};
        for (const job of glPipelineJobs) {
          if (!stages[job.stage]) {
            stages[job.stage] = [];
          }
          stages[job.stage].push({ id: job.id.toString(), name: job.name, status: job.status, duration: job.duration });
        }
        if (!didUnmount) {
          setStages(stages);
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
  }, [query, projectId, pipelineId, timestamp]);

  return { stages, error, isLoading, refresh };
}

interface Pipeline {
  id: number;
  iid: number;
  project_id: number;
  sha: string;
  ref: string;
  status: string;
  source: string;
}

interface CommitPipeline {
  id: number;
  project_id: number;
  sha: string;
  ref: string;
  status: string;
  source: string;
}

interface Commit {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  status?: string;
  project_id: number;
  last_pipeline?: CommitPipeline;
}

export function PipelineJobsListByCommit(props: { project: Project; sha: string }): JSX.Element {
  console.log("render PipelineJobsListByCommit");
  const { commit, isLoading, error } = useCommit(props.project.id, props.sha);
  if (error) {
    showToast(Toast.Style.Failure, "Could not fetch Commit Details", error);
  }
  if (isLoading || !commit) {
    return <Detail isLoading markdown={"hello"} />;
  }
  if (commit.last_pipeline) {
    return (
      <JobListByPipelineId
        projectFullPath={props.project.fullPath}
        projectId={props.project.id}
        pipelineId={commit.last_pipeline.id}
      />
    );
  }
  return (
    <List>
      <List.EmptyView title="No piplelines attached" />
    </List>
  );
}

function useCommit(
  projectID: number,
  sha: string
): {
  commit?: Commit;
  error?: string;
  isLoading: boolean;
} {
  const [commit, setCommit] = useState<Commit>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // FIXME In the future version, we don't need didUnmount checking
    // https://github.com/facebook/react/pull/22114
    let didUnmount = false;

    async function fetchData() {
      if (didUnmount) {
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        const glCommit = await gitlab
          .fetch(`projects/${projectID}/repository/commits/${sha}`)
          .then((data) => data as Commit);
        if (!didUnmount) {
          setCommit(glCommit);
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
  }, [projectID, sha]);

  return { commit, error, isLoading };
}
