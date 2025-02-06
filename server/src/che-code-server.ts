/**********************************************************************
 * Copyright (c) 2025 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

import express, { Request, Response, Application, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from './user.js';
import { debug } from './debug.js';
import { Service } from './service.js';


const __filename = fileURLToPath(import.meta.url);    // get the resolved path to the file
const __dirname = path.dirname(__filename);           // get the name of the directory
const __public = path.join(__dirname, '../public');   // path to the public directory
const __views = path.join(__dirname, '../views');     // path to the public directory

const HTTP_PORT = 3400;

export enum Page {
  ROOT = '/',                              // GET
  LOGIN = '/login',                        // GET
  LOGIN_MICROSOFT = '/login_microsoft',    // POST
  LOGIN_GITHUB = '/login_github',          // POST
  LOGIN_STATUS = '/login_status',          // POST
  LOGOUT = '/logout',                      // GET
  CREATE = '/create',                      // GET
}

export class CheCodeServer {
  instance = this;

  app: Application = express();
  user: User = new User();
  service: Service = new Service();

  async start(): Promise<void> {
    debug('> CheCodeServer :: start');
    debug(`  > __dirname: ${__dirname}`);
    debug(`  > __public: ${__public}`);

    this.app.use(express.static(__public));
    this.app.set('view engine', 'ejs');
    this.app.set('views', __views);
    this.app.listen(HTTP_PORT, async (err) => {
      if (err) {
        throw err;
      }

      debug(`Che-Code Server is listening on port ${HTTP_PORT}`);
    });

    // This middleware will log the request and 
    // allow it to proceed to the next handler
    this.app.use(function (request: Request, response: Response, next: NextFunction) {
      debug(`\n\n> ${request.method} ${request.path}`);
      next();
    });

    this.app.get(Page.ROOT, async (req: Request, res: Response) => this.root(req, res));
    this.app.get(Page.LOGIN, async (req: Request, res: Response) => this.login(req, res));
    this.app.post(Page.LOGIN_MICROSOFT, async (req: Request, res: Response) => this.loginMicrosoft(req, res));
    this.app.post(Page.LOGIN_GITHUB, async (req: Request, res: Response) => this.loginGitHub(req, res));
    this.app.post(Page.LOGIN_STATUS, async (req: Request, res: Response) => this.loginStatus(req, res));
    this.app.get(Page.LOGOUT, async (req: Request, res: Response) => this.logout(req, res));
    this.app.get(Page.CREATE, async (req: Request, res: Response) => this.create(req, res));

    if (await this.user.isLoggedIn()) {
      this.service.launch();
    }
  }

  redirect(response: Response, page: string) {
    response.redirect(page.startsWith('/') ? page.substring(1) : page);
  }

  async root(request: Request, response: Response) {
    if (await this.user.isLoggedIn()) {
      this.redirect(response, Page.CREATE);
      return;
    }

    this.redirect(response, Page.LOGIN);
  }

  async login(request: Request, response: Response) {
    if (await this.user.isLoggedIn()) {
      this.redirect(response, Page.CREATE);
      return;
    }

    response.render('login', {
      devworkspaceNamespace: process.env.DEVWORKSPACE_NAMESPACE,
      devworkspaceName: process.env.DEVWORKSPACE_NAME
    });
  }

  async loginMicrosoft(request: Request, response: Response) {
    const code = await this.user.loginWithMicrosoft();
    response.status(200).send(code);
  }

  async loginGitHub(request: Request, response: Response) {
    const code = await this.user.loginWithGitHub();
    response.status(200).send(code);
  }

  /**
   * Returns the status of the login procedure
   * 
   * 200 - login complete
   * 201 - login procedure is still in progress
   * 500 - login failed
   */
  async loginStatus(request: Request, response: Response) {
    const statusCode = await this.user.getLoginStatusCode();
    response.status(statusCode).send();
  }

  async logout(request: Request, response: Response) {
    await this.service.unregister();
    await this.service.killAll();
    await this.user.logout();

    this.redirect(response, Page.LOGIN);
  }

  async create(request: Request, response: Response) {
    if (!(await this.user.isLoggedIn())) {
      this.redirect(response, Page.LOGIN);
      return;
    }
  
    await this.service.launch();

    const devworkspaceNamespace = process.env.DEVWORKSPACE_NAMESPACE;
    const devworkspaceName = process.env.DEVWORKSPACE_NAME;
    const projectPath = process.env.PROJECT_SOURCE;
  
    const desktopLink = `vscode://ms-vscode.remote-server/open?tunnel=${devworkspaceName}&path=${projectPath}`;
    const webLink = `https://vscode.dev/tunnel/${devworkspaceName}/projects`;
  
    response.render('create', {
      devworkspaceNamespace, 
      devworkspaceName, 
      desktopLink,
      webLink, 
      dashboardURL: ''
    });
  }

}

(async (): Promise<void> => {
  const server = new CheCodeServer();

  try {
    await server.start();
    await new Promise(resolve => { });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
