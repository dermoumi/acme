import type { CAC } from "cac";

/**
 * The part of the `acme` CLI a kit is handed: enough to declare its own
 * commands, and nothing that would let it rename the program or its help.
 */
export type KitCommands = Pick<CAC, "command">;

/**
 * One capability an app takes on, such as a database or an error reporter.
 *
 * A kit is a plain object; a package exports a function taking the app's
 * options and answering one. The app lists the results in `kits`, in order.
 */
export interface Kit {
  /** Names the kit when something goes wrong. Conventionally the package's short name. */
  name: string;
  /**
   * Adds this kit's commands to `acme`, if it has any.
   *
   * What a command needs is already in scope: the app passed it to the
   * function that built the kit.
   */
  commands?: (cli: KitCommands) => void;
}
