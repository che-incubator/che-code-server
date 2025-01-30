# che-code-server
Allows your desktop Visual Studio Code to access your workspace

che-code-server editor yaml will be added to this repo
https://github.com/vitaliy-guliy/che-operator



## Download Visual Studo Code CLI

```
curl 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' --location -o /projects/code.tar.gz && tar --directory /projects -xvzf /projects/code.tar.gz
```

## Run che-code-server in development mode

- Install node dependencies

Devfile command: `devfile: Install dependencies`

```
$ cd /projects/che-code-server/server
$ npm install
```

- Compile and watch

Devfile command: `devfile: Compile an Watch`

```
$ cd /projects/che-code-server/server
$ npm run watch

```

- Run the server

Devfile command: `devfile: Run`

```
$ cd /projects/che-code-server/server
$ npm run start:watch

```

## Build che-code-server image

```
$ cd /projects/che-code-server
$ podman build --no-cache -f build/dockerfiles/Dockerfile -t quay.io/vgulyy/che-code-server:next .
$ podman push quay.io/vgulyy/che-code-server:next
```
