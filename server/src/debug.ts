/**********************************************************************
 * Copyright (c) 2025 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 ***********************************************************************/

// export const DEBUG_ENABLED = process.env.ENABLE_DEBUG == 'true' ? true : false;
export const DEBUG_ENABLED = true;

export function log(message: string) {
  console.log(message);
}

export function debug(message: string) {
  if (DEBUG_ENABLED) {
    console.log(message);
  }
}
