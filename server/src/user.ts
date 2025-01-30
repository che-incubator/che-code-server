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
import { VSCODE_CLI } from './service.js';
import { debug } from './debug.js';

export enum LoginStatus {
  NOT_SET = -1,
  SUCCESS = 0,
  FAILED = 1
}

export class User {

  login_status: LoginStatus = LoginStatus.NOT_SET;
  login_process: child_process.ChildProcess | undefined;

  /**
   * Verifies whether the user is already logged in.
   */
  async isLoggedIn() {
    debug('>> isLoggedIn ?');
    try {
      const output = child_process.execSync(`${VSCODE_CLI} tunnel user show`, { encoding: 'utf-8' });

      const regex = /logged in/;
      if (output.match(regex)) {
        return true;
      }

      return false;

    } catch (error) {
      const regex = /not logged in/;
      if (error.output && error.output.toString().match(regex)) {
        return false;
      }

      console.error(error);
      throw error;
    }
  }

  /**
   * 
   */
  async loginWithGitHub(): Promise<string> {
    debug('> login with Github');

    if (this.login_process !== undefined) {
      // Another login process is still in progress, kill and forget!!
      debug('>> another login process is still in progress');

      this.login_process.kill('SIGKILL');
      this.login_process = undefined;
      this.login_status = LoginStatus.NOT_SET;
    }
  
    let resolve: (value: string) => void;
    let reject: () => void;
  
    const waitPromise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  
    try {
      const process = child_process.spawn(VSCODE_CLI, ['tunnel', 'user', 'login', '--provider', 'github']);
      
      const regex = /use code [A-Z0-9]{4}-[A-Z0-9]{4}/;
      process.stdout.on('data', data => {
        debug(`stdout:\n${data}`);
  
        // wait for a message like below
        // To grant access to the server, please log into https://github.com/login/device and use code F65F-4303

        const str = '' + data;
        const match = str.match(regex);
  
        if (match) {
          const code = match[0].substring(9);
          debug(`> code [${code}]`);
          resolve(code);
        } else {
          debug("Code not found");
          reject();
        }
      })
  
      process.stderr.on("data", (data) => {
          debug(`stderr: ${data}`);
      });
  
      process.on('exit', (code) => {
          debug(`Process ended with code: ${code}`);

          if (code === null) {
            debug('    > Process seems to be killed!');
            // login process destroyed
            // Do not update status here! It should be set by another process.
            return;
          }

          if (code == 0) {
            this.login_status = LoginStatus.SUCCESS;
          } else {
            this.login_status = LoginStatus.FAILED;
          }
          
          this.login_process = undefined;
      })
  
      this.login_process = process;
      this.login_status = LoginStatus.NOT_SET;

    } catch (error) {
      console.error(error);
    }
  
    return waitPromise;
  }

  async loginWithMicrosoft() {
    debug('> login with Microsoft');

    if (this.login_process !== undefined) {
      // Another login process is still in progress, kill and forget!!
      debug('>> another login process is still in progress');

      this.login_process.kill('SIGKILL');
      this.login_process = undefined;
      this.login_status = LoginStatus.NOT_SET;
    }
  
    let resolve: (value: string) => void;
    let reject: () => void;
  
    const waitPromise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  
    try {
      const process = child_process.spawn(VSCODE_CLI, ['tunnel', 'user', 'login', '--provider', 'microsoft']);
      
      const regex = /enter the code [A-Z0-9]{9}/;
      process.stdout.on('data', data => {
        debug(`stdout:\n${data}`);
  
        // wait for a message like below
        // To sign in, use a web browser to open the page https://microsoft.com/devicelogin and enter the code F5X85TST3 to authenticate.

        const str = '' + data;
        const match = str.match(regex);
  
        if (match) {
          const code = match[0].substring(15);
          debug(`> code [${code}]`);
          resolve(code);
        } else {
          debug("Code not found");
          reject();
        }
      })
  
      process.stderr.on("data", (data) => {
          debug(`stderr: ${data}`);
      });
  
      process.on('exit', code => {
          debug(`Process ended with code: ${code}`);

          if (code === null) {
            debug('    > Process seems to be killed!');
            // login process destroyed
            // Do not update status here! It should be set by another process.
            return;
          }

          if (code == 0) {
            this.login_status = LoginStatus.SUCCESS;
          } else {
            this.login_status = LoginStatus.FAILED;
          }
          
          this.login_process = undefined;
      })
  
      this.login_process = process;
      this.login_status = LoginStatus.NOT_SET;

    } catch (error) {
      console.error(error);
    }
  
    return waitPromise;
  }

  /**
   * Returns
   *   200 when login procedure finished
   *   201 if the login process is still in progress
   *   500 if login failed
   */
  async getLoginStatusCode(): Promise<number> {
    if (this.login_process !== undefined) {
      return 201;
    }
    
    if (this.login_status == 0) {
      return 200;
    }

    return 500;
  }

  async logout(): Promise<void> {
    try {
      const output = child_process.execSync(`${VSCODE_CLI} tunnel user logout`, { encoding: 'utf-8' });
      console.log(`Output was: [${output}]`);
  
    } catch (error) {
      console.log(`> user logout failed. ${error}`);
  
      const STDERR = 1;

      const content = error.output[STDERR];
      console.log(`> output [${content}]`);
    }
  
  }

}
