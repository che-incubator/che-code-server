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

if (!process.env.VSCODE_CLI) {
  throw new Error('VSCODE_CLI environment variable is not defined');
}

export const VSCODE_CLI = process.env.VSCODE_CLI;
console.log(`> Visual Studio Code CLI: ${VSCODE_CLI}`);

export class Service {

  private exitCode: number | null = null;
  private serviceOutput: string = '';

  getExitCode(): number | null {
    return this.exitCode;
  }

  getServiceOutput(): string {
    return this.serviceOutput;
  }

  async launch(): Promise<void> {
    if (await this.isRunningDetached()) {
      console.log('> tunnel process is already running.');
      return;
    }
    
    console.log('> creating a tunnel...');
    
    // code tunnel --accept-server-license-terms --name ${DEVWORKSPACE_NAME}
    const devworkspaceName = process.env.DEVWORKSPACE_NAME;
    const projectPath = process.env.PROJECT_SOURCE;

    this.exitCode = -1;
    this.serviceOutput = '';

    try {
      const process = child_process.spawn(VSCODE_CLI, [
        'tunnel',
        '--accept-server-license-terms',
        '--name', devworkspaceName!], {
          cwd: projectPath
        });

      process.stdout.on('data', (data: string) => {
        console.log(`stdout:\n${data}`);
        this.serviceOutput += data;
      })

      process.stderr.on("data", (data: string) => {
        console.log(`stderr:\n${data}`);
        this.serviceOutput += data;
      });

      process.on('exit', (code: number | null) => {
        console.log(`Command Line Interface process ended with code: ${code}`);
        this.exitCode = code;
      })

    } catch (error) {
      console.error(error);
    }
  }

  async unregister(): Promise<void> {
    console.log('> unregister tunnel');

    if (await this.isRunningDetached()) {
      try {
        child_process.execSync(`${VSCODE_CLI} tunnel unregister`, { encoding: 'utf-8' });
        console.log('  > tunnel has been unregistered successfully')
      } catch (error) {
        console.error(error);
      }
    }

  }

  async isRunningDetached(): Promise<boolean> {
    let cliPath = VSCODE_CLI;
    const mask = `[${cliPath.charAt(0)}]${cliPath.substring(1)}`;

    try {
      child_process.execSync(`ps -ax | grep "${mask} tunnel --accept-server-license-terms"`, { encoding: 'utf-8' });
      return true;

    } catch (error) {
      return false;
    }
  }

  async killAll(): Promise<void> {
    console.log('> kill existing tunnel process');

    let cliPath = VSCODE_CLI;
    const mask = `[${cliPath.charAt(0)}]${cliPath.substring(1)}`;

    try {
      console.log('  > find process ID');
      const output = child_process.execSync(`ps -ax | grep "${mask} tunnel --accept-server-license-terms"`, { encoding: 'utf-8' });

      const lines = output.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (line) {
          console.log(`  > [${line}]`);
          const pid = line.substring(0, line.indexOf(' '));
          await this.killProcess(pid);
        }
      }
    } catch (error) {
      if (error.output) {
        const STDERR = 1;
        const output = error.output[STDERR];
        console.log(`ERROR:\n${output}`);
      }

      console.error(error);
    }
  }

  private async killProcess(pid: string): Promise<void> {
    console.log(`> kill PID: ${pid}`);

    try {
      child_process.execSync(`kill -9 ${pid}`, { encoding: 'utf-8' });
      console.log(`  > killed`);
    } catch (error) {
      console.error(error);
    }
  }

}
