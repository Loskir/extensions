import { exec } from "child_process";
import util from "util";

import { commandOutputToArray } from "../lib/cli.parser";
import { getBrewExecutablePath } from "../lib/cli";

const execPromise = util.promisify(exec);

const path = getBrewExecutablePath("kubectx");

export const getCurrentContext = async () => {
  const { stdout } = await execPromise(`source $HOME/.zshrc $HOME/.zprofile && ${path} -c`, {shell: 'zsh'});

  const currentContext = commandOutputToArray(stdout)[0];

  return currentContext;
};

export const getAllContextes = async () => {
  const { stdout } = await execPromise(`source $HOME/.zshrc $HOME/.zprofile && ${path}`, {shell: 'zsh'});

  const contextes = commandOutputToArray(stdout);

  return contextes;
};

export const switchContext = async (newContextName: string) => {
  await execPromise(`source $HOME/.zshrc $HOME/.zprofile && ${path} ${newContextName}`, {shell: 'zsh'});
};

export default {
  getAllContextes,
  getCurrentContext,
  switchContext,
};
