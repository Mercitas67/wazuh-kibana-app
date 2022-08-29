/*
 * Wazuh app - React component for restart Wazuh.
 * Copyright (C) 2015-2022 Wazuh, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Find more information about this on the LICENSE file.
 */

import React from 'react';
import {
  EuiButton,
  EuiButtonEmpty,
  EuiEmptyPrompt,
  EuiEmptyPromptProps,
  EuiFlexGroup,
  EuiFlexItem,
  EuiOverlayMask,
  EuiDescriptionList,
} from '@elastic/eui';
import { RestartHandler } from '../../../react-services/wz-restart';
import { useDispatch, useSelector } from 'react-redux';
import {
  updateRestartStatus,
  updateUnsynchronizedNodes,
  updateSyncNodesInfo,
} from '../../../redux/actions/restartActions';
import { UI_LOGGER_LEVELS } from '../../../../common/constants';
import { UI_ERROR_SEVERITIES } from '../../../react-services/error-orchestrator/types';
import { getErrorOrchestrator } from '../../../react-services/common-services';
import { RenderStatus } from './render-status';

/**
 * The restart modal to show feedback to the user.
 * @param props component's props
 * @returns components's body
 */
export const RestartModal = (props: {
  isSyncCanceled?: {};
  cancelSync?;
}) => {
  // TODO review if importing these functions in wz-restart work.
  const dispatch = useDispatch();
  const updateRedux = {
    updateUnsynchronizedNodes: (unsynchronizedNodes) =>
      dispatch(updateUnsynchronizedNodes(unsynchronizedNodes)),
    updateRestartStatus: (restartStatus) => dispatch(updateRestartStatus(restartStatus)),
    updateSyncNodesInfo: (syncNodesInfo) => dispatch(updateSyncNodesInfo(syncNodesInfo)),
  };

  // Cluster nodes that did not synced
  const unsyncedNodes = useSelector((state) => state.restartWazuhReducers.unsynchronizedNodes);

  // Current status of the restarting process
  const restartStatus = useSelector((state) => state.restartWazuhReducers.restartStatus);

  // Current status of the sync process
  const syncNodesInfo = useSelector((state) => state.restartWazuhReducers.syncNodesInfo);

  // Current status of the restart process
  const restartNodesInfo = useSelector((state) => state.restartWazuhReducers.restartNodesInfo);

  // Current section
  const section = useSelector((state) => state.rulesetReducers.section);

  const forceRestart = async () => {
    try {
      await RestartHandler.restartWazuh(updateRedux);
    } catch (error) {
      const options = {
        context: `${RestartModal.name}.forceRestart`,
        level: UI_LOGGER_LEVELS.ERROR,
        severity: UI_ERROR_SEVERITIES.BUSINESS,
        error: {
          error: error,
          message: error.message || error,
          title: error.name || error,
        },
      };
      getErrorOrchestrator().handleError(options);
    }
  };

  const abort = () => {
    dispatch(updateRestartStatus(RestartHandler.RESTART_STATES.RESTARTED));
    dispatch(updateUnsynchronizedNodes([]));
    props.cancelSync && props.cancelSync();
  };

  // Build the modal depending on the restart state.
  let emptyPromptProps: Partial<EuiEmptyPromptProps>;
  switch (restartStatus) {
    default:
    case RestartHandler.RESTART_STATES.RESTARTED_INFO:
      emptyPromptProps = {
        title: (
          <>
            <h2 className="wz-modal-restart-title">Wazuh restarted</h2>
          </>
        ),
        body: (
          <>
            <h4 className="wz-padding-left-16 wz">Restart completed:</h4>
            <div className="wz-info-nodes-restart">
              <EuiDescriptionList
                textStyle="reverse"
                align="center"
                type="column"
                style={{ maxWidth: '20000px' }}
              >
                {restartNodesInfo.map((node, index) => (
                  <RenderStatus
                    node={node}
                    key={index}
                    statusRestart={RestartHandler.RESTART_STATES.RESTARTED_INFO}
                  />
                ))}
              </EuiDescriptionList>
            </div>
          </>
        ),
        actions: (
          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButton color="primary" fill onClick={abort}>
                Aceptar
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        )
      };
      break;

    case RestartHandler.RESTART_STATES.RESTARTING:
      emptyPromptProps = {
        title: (
          <>
            <h2 className="wz-modal-restart-title">Restarting Wazuh</h2>
          </>
        ),
        body: (
          <>
            <h4 className="wz-padding-left-16">Checking restart:</h4>
            <div className="wz-info-nodes-restart">
              <EuiDescriptionList
                textStyle="reverse"
                align="center"
                type="column"
                style={{ maxWidth: '20000px' }}
              >
                {restartNodesInfo.map((node, index) => (
                  <RenderStatus
                    node={node}
                    key={index}
                    statusRestart={RestartHandler.RESTART_STATES.RESTARTING}
                  />
                ))}
              </EuiDescriptionList>
            </div>
          </>
        ),
        actions: (
          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButton color="primary" disabled fill onClick={abort}>
                Aceptar
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        )
      };
      break;

    case RestartHandler.RESTART_STATES.RESTART_ERROR:
      emptyPromptProps = {
        title: <h2 className="wz-modal-restart-title">Unable to connect to Wazuh.</h2>,
        body: (
          <>
            <h4 className="wz-padding-left-16 wz">Restart error:</h4>
            <div className="wz-info-nodes-restart">
              <EuiDescriptionList
                textStyle="reverse"
                align="center"
                type="column"
                style={{ maxWidth: '20000px' }}
              >
                {restartNodesInfo.map((node, index) => (
                  <RenderStatus
                    node={node}
                    key={index}
                    statusRestart={RestartHandler.RESTART_STATES.RESTART_ERROR}
                  />
                ))}
              </EuiDescriptionList>
            </div>
            <p>There was an error restarting Wazuh.</p>
          </>
        ),
        actions: (
          <EuiButton color="primary" fill href="#/health-check">
            Go to Healthcheck
          </EuiButton>
        ),
      };
      break;

    case RestartHandler.RESTART_STATES.SYNC_ERROR:
      emptyPromptProps = {
        title: <h2 className="wz-modal-restart-title">Synchronization failed</h2>,
        body: (
          <>
            {syncNodesInfo.length > 0 && (
              <div className="wz-info-nodes-restart">
                <EuiDescriptionList textStyle="reverse" align="center" type="column">
                  {syncNodesInfo.map((node, index) => (
                    <RenderStatus
                      node={node}
                      key={index}
                      statusRestart={RestartHandler.RESTART_STATES.SYNC_ERROR}
                    />
                  ))}
                </EuiDescriptionList>
              </div>
            )}
            <p className="wz-text-justify">
              The nodes <b className="wz-text-black">{unsyncedNodes.join(', ')}</b> did not
              synchronize. Restarting Wazuh might set the cluster into an inconsistent state. Close
              and try again later.
            </p>
          </>
        ),
        actions: (
          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty color="danger" flush="both" onClick={forceRestart}>
                Force restart
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton color="primary" fill onClick={abort}>
                Cancel
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        ),
      };
      break;

    case RestartHandler.RESTART_STATES.SYNCING:
      emptyPromptProps = {
        title: (
          <>
            <h2 className="wz-modal-restart-title">Ensuring {section} deployment</h2>
          </>
        ),
        body: (
          <>
            {syncNodesInfo.length > 0 && (
              <>
                <h4 className="wz-padding-left-16 wz">Checking synchronization:</h4>
                <div className="wz-info-nodes-restart">
                  <EuiDescriptionList
                    textStyle="reverse"
                    align="center"
                    type="column"
                    style={{ maxWidth: '20000px' }}
                  >
                    {syncNodesInfo.map((node, index) => (
                      <RenderStatus
                        node={node}
                        key={index}
                        statusRestart={RestartHandler.RESTART_STATES.SYNCING}
                      />
                    ))}
                  </EuiDescriptionList>
                </div>
              </>
            )}
          </>
        ),
        actions: (
          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiButtonEmpty disabled color="danger" flush="both" onClick={forceRestart}>
                Force restart
              </EuiButtonEmpty>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiButton color="primary" fill onClick={abort}>
                Cancel
              </EuiButton>
            </EuiFlexItem>
          </EuiFlexGroup>
        ),
      };
      break;
  }

  //
  return (
    <EuiOverlayMask>
      <div
        className={
          restartStatus === RestartHandler.RESTART_STATES.ERROR
            ? 'wz-modal-restart-error'
            : 'wz-modal-restart'
        }
      >
        <EuiEmptyPrompt {...emptyPromptProps} />
      </div>
    </EuiOverlayMask>
  );
};