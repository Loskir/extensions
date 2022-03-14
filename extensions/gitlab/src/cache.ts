import { environment } from "@raycast/api";
import path from "path/posix";
import * as fs from "fs/promises";
import { constants } from "fs";
import { currentSeconds, daysInSeconds, fileExists, getErrorMessage } from "./utils";
import { useEffect, useRef, useState } from "react";

export function getLargeCacheDirectory(): string {
  const sp = environment.supportPath;
  const cacheDir = path.join(sp, "cache");
  return cacheDir;
}

export async function getCacheFilepath(key: string, ensureDirectory = false): Promise<string> {
  const cacheDir = getLargeCacheDirectory();
  if (ensureDirectory) {
    console.log(`create cache directoy '${cacheDir}'`);
    await fs.mkdir(cacheDir, { recursive: true });
  }
  const cacheFilePath = path.join(cacheDir, `${key}.json`);
  return cacheFilePath;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getLargeCacheObjectData(key: string): Promise<{ data: any; ageInSeconds: number } | undefined> {
  let cacheFilePath = undefined;
  try {
    cacheFilePath = await getCacheFilepath(key);
    await fs.access(cacheFilePath, constants.R_OK);
    const jsontext = await fs.readFile(cacheFilePath, "utf-8");
    const cache_data = JSON.parse(jsontext);
    if (!cache_data) {
      return undefined;
    }
    const timestamp = currentSeconds();
    const delta = timestamp - cache_data.timestamp;
    return { data: cache_data.payload, ageInSeconds: delta };
  } catch (e) {
    console.log(`could not access cache file or not exists '${cacheFilePath}'`);
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getLargeCacheObject(key: string, seconds: number): Promise<any> {
  console.log("GET cache");
  let cacheFilePath = undefined;
  try {
    cacheFilePath = await getCacheFilepath(key);
    await fs.access(cacheFilePath, constants.R_OK);
    const jsontext = await fs.readFile(cacheFilePath, "utf-8");
    const cache_data = JSON.parse(jsontext);
    if (!cache_data) {
      return undefined;
    }
    const timestamp = currentSeconds();
    const delta = timestamp - cache_data.timestamp;
    if (delta > seconds) {
      return undefined;
    } else {
      return cache_data.payload;
    }
  } catch (e) {
    console.log(`could not access cache file or not exists '${cacheFilePath}'`);
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export async function setLargeCacheObject(key: string, payload: any): Promise<void> {
  let cacheFilePath = undefined;
  try {
    cacheFilePath = await getCacheFilepath(key, true);
    console.log(`set cache object '${key}'`);
    const cache_data = {
      timestamp: currentSeconds(),
      payload: payload,
    };
    const text = JSON.stringify(cache_data);
    await fs.writeFile(cacheFilePath, text, "utf-8");
  } catch (e) {
    console.log(e);
    console.log(`could not write cache file '${cacheFilePath}'`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function receiveLargeCachedObject(key: string, fn: () => Promise<any>): Promise<any> {
  let data = await getLargeCacheObject(key, 5 * 60);
  if (!data) {
    data = await fn();
    await setLargeCacheObject(key, data);
    return data;
  } else {
    console.log("use cached data");
    return data;
  }
}

export async function clearLargeObjectCache(): Promise<void> {
  const cacheDir = getLargeCacheDirectory();
  if (await fileExists(cacheDir)) {
    await fs.rm(cacheDir, { recursive: true });
  }
}

export function useCache<T>(
  key: string,
  getData: () => Promise<T>,
  options: {
    deps?: React.DependencyList;
    onFilter?: (data: T) => Promise<T>;
    secondsToRefetch?: number;
    secondsToInvalid?: number;
  }
): {
  data?: T;
  error?: string;
  isLoading: boolean;
  performRefetch: () => void;
} {
  const secondsToRefetchUser = options.secondsToRefetch === undefined ? 5 * 60 : options.secondsToRefetch;
  const secondsToInvalid = options.secondsToInvalid === undefined ? daysInSeconds(3) : options.secondsToInvalid;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [timestamp, setTimestamp] = useState<Date>(new Date());
  const shouldForceRefetch = useRef(false);
  const depsAll = [timestamp];
  if (options.deps) {
    for (const d of options.deps) {
      depsAll.push(d);
    }
  }

  const search = async (alldata: T) => {
    if (options.onFilter) {
      return await options.onFilter(alldata);
    }
    return alldata;
  };

  const performRefetch = () => {
    shouldForceRefetch.current = true;
    setTimestamp(new Date());
  };

  useEffect(() => {
    let refetch = false;

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
        console.log("check data from cache");
        const secondsToRefetch = shouldForceRefetch.current === true ? 0 : secondsToRefetchUser;
        if (shouldForceRefetch.current) {
          console.log("force refetch");
        }
        const cacheData = await getLargeCacheObjectData(key);
        if (cacheData && cacheData.ageInSeconds < secondsToInvalid) {
          console.log("cache data found");
          if (!didUnmount) {
            console.log("set cache data");
            setData(await search(cacheData.data));
            console.log(`${cacheData.ageInSeconds}  vs  ${secondsToRefetch}`);
            if (cacheData.ageInSeconds > secondsToRefetch) {
              console.log("cache is older, start refetch");
              // older than x minutes, refetch data and set it again
              refetch = true;
              getData()
                .then(async (value) => {
                  console.log("set refetched data");
                  setLargeCacheObject(key, value);
                  value = await search(value);
                  refetch = false;
                  if (!didUnmount) {
                    setData(value);
                    setIsLoading(false);
                  }
                })
                .catch((e) => {
                  if (!didUnmount) {
                    setError(e);
                  }
                })
                .finally(() => {
                  if (!didUnmount) {
                    setIsLoading(false);
                    refetch = false;
                  }
                });
            }
          }
        } else {
          console.log("no cache data, start fetch");
          const data = await getData();
          setLargeCacheObject(key, data);
          if (!didUnmount) {
            setData(await search(data));
          }
        }
      } catch (e) {
        if (!didUnmount) {
          setError(getErrorMessage(e));
        }
      } finally {
        if (shouldForceRefetch) {
          shouldForceRefetch.current = false;
        }
        if (!didUnmount && !refetch) {
          setIsLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      didUnmount = true;
    };
  }, depsAll);

  return { data, error, isLoading, performRefetch };
}
