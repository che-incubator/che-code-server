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
import { Service } from './service.js';

if (!process.env.DEVWORKSPACE_NAME) {
  throw new Error('DEVWORKSPACE_NAME environment variable is not defined');
}

// replace dots on dashes
process.env.DEVWORKSPACE_NAME = process.env.DEVWORKSPACE_NAME!.replaceAll('.', '-');

// truncate Dev Workspace name if it is longer 20 characters
if (process.env.DEVWORKSPACE_NAME!.length > 20) {
  process.env.DEVWORKSPACE_NAME = process.env.DEVWORKSPACE_NAME!.substring(0, 20);
}

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
  CREATE_STATUS = '/create_status'         // POST
}

export class CheCodeServer {
  instance = this;

  app: Application = express();
  user: User = new User();
  service: Service = new Service();

  async start(): Promise<void> {
    console.log('> CheCodeServer :: start');
    console.log(`  > __dirname: ${__dirname}`);
    console.log(`  > __public: ${__public}`);

    this.app.use(express.static(__public));
    this.app.set('view engine', 'ejs');
    this.app.set('views', __views);
    this.app.listen(HTTP_PORT, async (err) => {
      if (err) {
        throw err;
      }

      console.log(`Che-Code Server is listening on port ${HTTP_PORT}`);
    });

    // This will log the request and allow it to proceed to the next handler
    this.app.use(function (request: Request, response: Response, next: NextFunction) {
      console.log(`\n> ${request.method} ${request.path}`);
      next();
    });

    this.app.get(Page.ROOT, async (req: Request, res: Response) => this.root(req, res));
    this.app.get(Page.LOGIN, async (req: Request, res: Response) => this.login(req, res));
    this.app.post(Page.LOGIN_MICROSOFT, async (req: Request, res: Response) => this.loginMicrosoft(req, res));
    this.app.post(Page.LOGIN_GITHUB, async (req: Request, res: Response) => this.loginGitHub(req, res));
    this.app.post(Page.LOGIN_STATUS, async (req: Request, res: Response) => this.loginStatus(req, res));
    this.app.get(Page.LOGOUT, async (req: Request, res: Response) => this.logout(req, res));
    this.app.get(Page.CREATE, async (req: Request, res: Response) => this.create(req, res));
    this.app.post(Page.CREATE_STATUS, async (req: Request, res: Response) => this.createStatus(req, res));

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
    const webLink = `https://vscode.dev/tunnel/test/projects/${devworkspaceName}`;
  
    response.render('create', {
      devworkspaceNamespace, 
      devworkspaceName, 
      desktopLink,
      webLink, 
      dashboardURL: ''
    });
  }

  /**
   * Returns the state of the tunnel creation process
   * 
   * 200 - tunnel created
   * 202 - tunnel creation is still in progress
   * 404 - tunnel creation is not started yet
   * 403 - creation failed
   */
  async createStatus(request: Request, response: Response) {
    const exitCode = this.service.getExitCode();
    const output = this.service.getServiceOutput();

    if (null === exitCode) {
      if (await this.service.isRunningDetached()) {
        console.log('> tunnel seems to be created');
        response.status(200).send();
        return;
      }

      console.log('> tunnel creation is not started yet');
      response.status(404).send();
      return;
    }

    if (exitCode >= 0) {
      // tunnel creation failed
      // get the error from the output

      console.log(`> output:\n${output}`);
      
      const message = output.split('\n').filter(value => value && !value.startsWith('*')).join('\r\n');
      response.status(403).send(message);
      return;
    }

    // tunnel creation is still in progress ( exitCode is -1 ) 
    // new tunnel may be already created, need to check the output for readiness
    
    console.log(`> output:\n${output}`);

    // find the line with a proposal to open the link
    const regex = /^Open this link/gim;
    if (regex.test(output)) {
      console.log('> tunnel created successfully');
      response.status(200).send();
      return;
    }

    // creating is still in progress
    response.status(202).send();
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
