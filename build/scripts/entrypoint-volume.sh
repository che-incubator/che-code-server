#!/bin/sh
#
# Copyright (c) 2025 Red Hat, Inc.
# This program and the accompanying materials are made
# available under the terms of the Eclipse Public License 2.0
# which is available at https://www.eclipse.org/legal/epl-2.0/
#
# SPDX-License-Identifier: EPL-2.0
#
# Contributors:
#   Red Hat, Inc. - initial API and implementation
#

# Being called as a post-start command, the script runs the IDE
# from the shared volume which should be mounted to a folder in a dev container.

# Register the current (arbitrary) user.
if ! whoami &> /dev/null; then
  if [ -w /etc/passwd ]; then
    echo "Registering the current (arbitrary) user."
    echo "${USER_NAME:-user}:x:$(id -u):0:${USER_NAME:-user} user:${HOME}:/bin/bash" >> /etc/passwd
    echo "${USER_NAME:-user}:x:$(id -u):" >> /etc/group
  fi
fi

# mounted volume path
che_code_server_path="/che-code-server"

echo "Volume content:"
ls -la "$che_code_server_path"


libssl_version=""
get_libssl_version() {
  libssl=$(find / -type f \( -name "libssl.so*" \) 2>/dev/null)
  if [ -z "$libssl" ]; then
    for dir in /lib64 /usr/lib64 /lib /usr/lib /usr/local/lib64 /usr/local/lib; do
      for file in "$dir"/libssl.so*; do
        if [ -e "$file" ]; then
          libssl="$file"
          break 2
        fi
      done
    done
  fi

  echo "[INFO] libssl: $libssl"

  case "${libssl}" in
  *libssl.so.1*)
    echo "[INFO] libssl version is: 1"
    libssl_version="1"
    ;;
  *libssl.so.3*)
    echo "[INFO] libssl version is: 3"
    libssl_version="3"
    ;;
  *)
    libssl_version=""
    echo "[WARNING] unknown libssl version: $libssl"
    ;;
  esac
}

openssl_version=""
get_openssl_version() {
  if command -v openssl >/dev/null 2>&1; then
    echo "[INFO] openssl command is available, OpenSSL version is: $(openssl version -v)"
    openssl_version=$(openssl version -v | cut -d' ' -f2 | cut -d'.' -f1)
  elif command -v rpm >/dev/null 2>&1; then
    echo "[INFO] rpm command is available"
    openssl_version=$(rpm -qa | grep openssl-libs | cut -d'-' -f3 | cut -d'.' -f1)
  else
    echo "[INFO] openssl and rpm commands are not available, trying to detect OpenSSL version..."
    get_libssl_version
    openssl_version=$libssl_version
  fi
}

export VSCODE_CLI="/che-code-server/code"
export SHELL="/bin/bash"
export PS1="\\[\\]\\W \`git branch --show-current 2>/dev/null | sed -r -e \"s@^(.+)@\\(\\1\\) @\"\`\$ \\[\\]"

# Start the app that checks the IDE server status.
# This will be workspace's 'main' endpoint.
cd "$che_code_server_path"
if command -v npm &> /dev/null; then
  # Node.js installed in a user's container
  # nohup npm start &
  node server/out/che-code-server.js > $che_code_server_path/server.out
else
  # no Node.js installed,
  # use the one that editor-injector provides
  get_openssl_version
  echo "[INFO] OpenSSL major version is: $openssl_version."

  case "${openssl_version}" in
  *"1"*)
    mv "$che_code_server_path"/node-ubi8 "$che_code_server_path"/node
    ;;
  *"3"*)
    mv "$che_code_server_path"/node-ubi9 "$che_code_server_path"/node
    ;;
  *)
    echo "[WARNING] Unsupported OpenSSL major version. Node.js from UBI9 will be used."
    mv "$che_code_server_path"/node-ubi9 "$che_code_server_path"/node
    ;;
  esac

  "$che_code_server_path"/node server/out/che-code-server.js > $che_code_server_path/server.out
  # nohup "$che_code_server_path"/node index.js &
fi

echo "STUB: Running tail -f /dev/null"
tail -f /dev/null
