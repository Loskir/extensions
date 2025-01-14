import Entry from "../models/entry"
import { useCallback, useState } from "react"
import {
  Alert,
  Clipboard,
  confirmAlert,
  getPreferenceValues,
  LocalStorage,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api"
import { useEntryStore, useNavigationStore } from "../store"
import CommandRunner from "../views/command-runner"
import { v4 as uuidv4 } from "uuid"
import type { Preferences } from "../rsync-commands"

type UseEntriesOutput = {
  entries: Entry[]
  entryRunning: boolean
  addEntry: (entry: Entry) => Promise<boolean>
  updateEntry: (entry: Entry, resetConfirmed?: boolean, skipValidation?: boolean) => Promise<boolean>
  deleteEntry: (entry: Entry) => void
  runEntry: (entry: Entry) => Promise<boolean>
  copyEntryCommand: (entry: Entry) => void
}

const useEntries = (): UseEntriesOutput => {
  const [entryRunning, setEntryRunning] = useState<boolean>(false) // If a rsync command is running

  const { push } = useNavigation()
  const [entries, setEntries] = useEntryStore(state => [state.entries, state.setEntries])
  const setCreatedEntry = useNavigationStore(state => state.setSelectedEntry)
  const preferences = getPreferenceValues<Preferences>()

  const storeEntries = (entries: Entry[]) => {
    LocalStorage.setItem("entries", JSON.stringify(entries.map(e => e.toRawData())))
  }

  const updateEntries = useCallback(
    (entries: Entry[]) => {
      setEntries(entries)
      storeEntries(entries)
    },
    [setEntries]
  )

  const validateEntry = async (entry: Entry) => {
    try {
      entry.validate()
    } catch (err: any) {
      await showToast({
        style: Toast.Style.Failure,
        title: err,
      })
      return false
    }

    return true
  }

  const addEntry = async (entry: Entry) => {
    if (await validateEntry(entry)) {
      entry.id = uuidv4()
      const newEntries: Entry[] = [...entries, entry]
      updateEntries(newEntries)
      setCreatedEntry(entry.id)
      await showToast({
        style: Toast.Style.Success,
        title: "Entry created",
      })
      return true
    }
    return false
  }

  const updateEntry = async (entry: Entry, resetConfirmed = true, skipValidation = false) => {
    if (skipValidation || (await validateEntry(entry))) {
      if (resetConfirmed) entry.confirmed = false
      const prevEntryIndex = entries.findIndex(e => e.id === entry.id)
      if (prevEntryIndex === -1) throw "Could not find entry to update"
      const oldEntry = entries[prevEntryIndex]
      if (!oldEntry.equals(entry)) {
        const newEntries = [...entries]
        newEntries.splice(prevEntryIndex, 1, entry)
        updateEntries(newEntries)
        await showToast({
          style: Toast.Style.Success,
          title: "Entry updated",
        })
      }
      return true
    }
    return false
  }

  const deleteEntry = async (entry: Entry) => {
    const prevEntryIndex = entries.findIndex(e => e.id === entry.id)
    if (prevEntryIndex === -1) throw "Could not find entry to update"
    const newEntries = [...entries]
    newEntries.splice(prevEntryIndex, 1)
    updateEntries(newEntries)
    await showToast({
      style: Toast.Style.Success,
      title: "Entry deleted",
    })
  }

  const getEntryCommand = async (entry: Entry) => {
    await validateEntry(entry)
    return entry.getCommand()
  }

  const runEntry = async (entry: Entry, pushResultView = true) => {
    if (await validateEntry(entry)) {
      const command = await getEntryCommand(entry)

      if (!preferences.noVerifyCommands && !entry.confirmed) {
        const confirmResponse = await confirmAlert({
          title: "Are you sure about this?",
          message: `Rsync can be a destructive command. You have to confirm a command before running it the first time after creation, as well as after each update.`,
          primaryAction: {
            title: "Execute",
            style: Alert.ActionStyle.Destructive,
          },
        })
        if (!confirmResponse) return false
      }

      const clone = entry.clone()
      clone.confirmed = true
      const prevRunCount = clone.runCount ?? 0
      clone.runCount = prevRunCount + 1
      await updateEntry(clone, false)

      setEntryRunning(true)
      if (command && pushResultView) {
        push(<CommandRunner command={command} />)
      }
      setEntryRunning(false)
      return true
    }
    return false
  }

  const copyEntryCommand = async (entry: Entry) => {
    const command = await getEntryCommand(entry)
    if (command) {
      await Clipboard.copy(command)
      await showToast({
        style: Toast.Style.Success,
        title: "Copied Command to Clipboard",
      })
    }
  }

  return { entries, addEntry, updateEntry, deleteEntry, runEntry, copyEntryCommand, entryRunning }
}

export default useEntries
