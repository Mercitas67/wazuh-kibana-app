/*
 * Wazuh app - Generic request
 * Copyright (C) 2015-2022 Wazuh, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Find more information about this on the LICENSE file.
 */

import { AppState } from './app-state';
import { WazuhConfig } from './wazuh-config';
import { ApiCheck } from './wz-api-check';
import { WzMisc } from '../factories/misc';
import { getHttp, getDataPlugin } from '../kibana-services';
import { PLUGIN_PLATFORM_REQUEST_HEADERS } from '../../common/constants';
import { request } from '../services/request-handler';

export class GenericRequest {
  static async request(
    method: RequestMethod,
    path: string,
    payload: any = null,
    returnError = false
  ) {
    try {
      if (!method || !path) {
        throw new Error('Missing parameters');
      }
      const wazuhConfig = new WazuhConfig();
      const { timeout } = wazuhConfig.getConfig();
      const requestHeaders: any = {
        ...PLUGIN_PLATFORM_REQUEST_HEADERS,
        'content-type': 'application/json',
      };
      const tmpUrl = getHttp().basePath.prepend(path);

      try {
        requestHeaders.pattern = (
          await getDataPlugin().indexPatterns.get(AppState.getCurrentPattern())
        ).title;
      } catch (error) {}

      try {
        requestHeaders.id = JSON.parse(AppState.getCurrentAPI()).id;
      } catch (error) {
        // Intended
      }
      var options = {
        method: method,
        headers: requestHeaders,
        url: tmpUrl,
        timeout: timeout || 20000,
      };

      const data = {};

      if (['PUT', 'POST', 'DELETE'].includes(method)) {
        options['data'] = payload;
      }

      Object.assign(data, await request(options));
      if (!data) {
        throw new Error(`Error doing a request to ${tmpUrl}, method: ${method}.`);
      }

      return data;
    } catch (err) {
      //if the requests fails, we need to check if the API is down
      const currentApi = JSON.parse(AppState.getCurrentAPI() || '{}');
      if (currentApi && currentApi.id) {
        try {
          await ApiCheck.checkStored(currentApi.id);
        } catch (err) {
          const wzMisc = new WzMisc();
          wzMisc.setApiIsDown(true);

          if (
            !window.location.hash.includes('#/settings') &&
            !window.location.hash.includes('#/health-check') &&
            !window.location.hash.includes('#/blank-screen')
          ) {
            window.location.href = getHttp().basePath.prepend('/app/wazuh#/health-check');
          }
        }
      }
      const responseError = ErrorFactory.createError(err as Error);
      if (returnError) return Promise.reject(responseError);
      return Promise.reject(responseError);
    }
  }
}
