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

# Being called as a pre-start command, the script downloads the requested IDE and
# copies the binaries to the shared volume which should be mounted to a folder in a dev container.

# mounted volume path
che_code_server_path="/che-code-server"

mkdir -p $che_code_server_path
cp -r /server "$che_code_server_path"/
cp /entrypoint-volume.sh "$che_code_server_path"/

# Download Visual Studio Code Command Line Interface (CLI) binary to the shared volume.
cd "$che_code_server_path"

echo "Downloading Visual Studio Code CLI..."

curl 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' --location -o code.tar.gz
tar -xvzf code.tar.gz
rm code.tar.gz

# Copy Node.js binaries to the editor volume.
# It will be copied to the user container if it's absent.
cp /usr/bin/node "$che_code_server_path"/node-ubi9
cp /node-ubi8 "$che_code_server_path"/node-ubi8

echo "Volume content:"
ls -la "$che_code_server_path"
