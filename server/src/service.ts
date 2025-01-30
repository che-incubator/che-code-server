/**********************************************************************
 * Copyright (c) 2025 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

import * as child_process from 'child_process';
import { debug } from './debug.js';

// export const VSCODE_CLI = '/projects/code';
if (!process.env.VSCODE_CLI) {
  throw new Error('VSCODE_CLI environment variable is not defined');
}

export const VSCODE_CLI = process.env.VSCODE_CLI;
console.log(`>>> VSCODE CLI CONFIGURED TO: ${VSCODE_CLI}`);

export class Service {

  async launch(): Promise<void> {
    debug('> launching service...');

    if (await this.isRunningDetached()) {
      debug('> TUNNEL process is running detached -> RETURN. code tunnel status returned a value');
      return;
    }

    // /projects/code --log debug tunnel --accept-server-license-terms --name ${DEVWORKSPACE_NAME}
    const devworkspaceName = process.env.DEVWORKSPACE_NAME;
    const projectPath = process.env.PROJECT_SOURCE;

    try {
      const process = child_process.spawn(VSCODE_CLI, [
        'tunnel',
        '--accept-server-license-terms',
        '--name', devworkspaceName!], {
          cwd: projectPath
        });

      process.stdout.on('data', (data: string) => {
        debug(`stdout: ${data}`);
      })

      process.stderr.on("data", (data: string) => {
        debug(`stderr: ${data}`);
      });

      process.on('exit', (code: number | null) => {
        debug(`Process ended with code: ${code}`);
      })

    } catch (error) {
      console.error(error);
    }
  }

  async unregister(): Promise<void> {
    debug('> unregister tunnel');

    if (await this.isRunningDetached()) {
      try {
        const output = child_process.execSync(`${VSCODE_CLI} tunnel unregister`, { encoding: 'utf-8' });
        debug(`Output:\n${output}`);
        debug('>> SEEEEMS tunnel has been unregistered successfully')
      } catch (error) {
        console.error(error);
      }
    }

  }

  async isRunningDetached(): Promise<boolean> {
    debug('> is running detached?');
    let cliPath = VSCODE_CLI;
    const mask = `[${cliPath.charAt(0)}]${cliPath.substring(1)}`;

    try {
      child_process.execSync(`ps -ax | grep "${mask} tunnel --accept-server-license-terms"`, { encoding: 'utf-8' });
      // const output = child_process.execSync(`ps -ax | grep "${mask} tunnel --accept-server-license-terms"`, { encoding: 'utf-8' });
      // debug(`Output:\n${output}`);
      // debug('>> SEEEEMS there are several tunnel instances')
      return true;

    } catch (error) {
      return false;
    }
  }

  async killAll(): Promise<void> {
    console.log('>>>> KILL ALL !!');

    let cliPath = VSCODE_CLI;
    // debug(`> cli path [${cliPath}]`);
    const mask = `[${cliPath.charAt(0)}]${cliPath.substring(1)}`;
    // debug(`> mask [${mask}]`);

    try {
      const output = child_process.execSync(`ps -ax | grep "${mask} tunnel --accept-server-license-terms"`, { encoding: 'utf-8' });

      const lines = output.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (line) {
          debug(`>> [${line}]`);

          const pid = line.substring(0, line.indexOf(' '));
          console.log(`>> PID [${pid}]`);

          await this.killProcess(pid);
        }
      }


    } catch (error) {
      if (error.output) {
        const STDERR = 1;
        const output = error.output[STDERR];
        debug(`Output BBB:\n${output}`);
      }

      console.error(error);
      // throw error;
    }
  }

  private async killProcess(pid: string): Promise<void> {
    try {
      const output = child_process.execSync(`kill -9 ${pid}`, { encoding: 'utf-8' });
      debug(`Output:\n${output}`);

      debug(`>> Process PID:${pid} seems to be killed`);
    } catch (error) {
      debug(`>> ERR: unable to kill PID:${pid}`);
      console.error(error);
    }
  }

}
