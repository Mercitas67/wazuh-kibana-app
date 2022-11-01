/*
 * Wazuh app - React component for registering agents.
 * Copyright (C) 2015-2022 Wazuh, Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Find more information about this on the LICENSE file.
 */
import React, { Component, Fragment } from 'react';
import { version } from '../../../../package.json';
import { WazuhConfig } from '../../../react-services/wazuh-config';
import {
  EuiSteps,
  EuiTabbedContent,
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiButtonGroup,
  EuiComboBox,
  EuiFieldText,
  EuiText,
  EuiCodeBlock,
  EuiTitle,
  EuiButtonEmpty,
  EuiCopy,
  EuiPage,
  EuiPageBody,
  EuiCallOut,
  EuiSpacer,
  EuiProgress,
  EuiCode,
  EuiLink,
  EuiIcon,
  EuiSwitch
} from '@elastic/eui';
import { WzRequest } from '../../../react-services/wz-request';
import { withErrorBoundary } from '../../../components/common/hocs';
import { UI_LOGGER_LEVELS } from '../../../../common/constants';
import { UI_ERROR_SEVERITIES } from '../../../react-services/error-orchestrator/types';
import { getErrorOrchestrator } from '../../../react-services/common-services';
import { webDocumentationLink } from '../../../../common/services/web_documentation';
import { architectureButtons, architectureCentos5OrRedHat5, osButtons, versionButtonsCentosOrRedHat } from './config'
import { optionalPackages } from './services'
import { AgentGroup, ServerAddress } from './steps'

export const RegisterAgent = withErrorBoundary(

  class RegisterAgent extends Component {
    constructor(props) {
      super(props);
      this.wazuhConfig = new WazuhConfig();
      this.configuration = this.wazuhConfig.getConfig();
      this.state = {
        status: 'incomplete',
        selectedOS: '',
        selectedSYS: '',
        neededSYS: false,
        selectedArchitecture: '',
        selectedVersion: '',
        version: '',
        wazuhVersion: '',
        serverAddress: '',
        wazuhPassword: '',
        groups: [],
        selectedGroup: [],
        udpProtocol: false,
        showPassword: false,
      };
      this.restartAgentCommand = {
        rpm: this.systemSelector(),
        deb: this.systemSelector(),
        macos: 'sudo /Library/Ossec/bin/wazuh-control start',
        win: 'NET START WazuhSvc'
      };
    }

    async componentDidMount() {
      try {
        this.setState({ loading: true });
        const wazuhVersion = await this.props.getWazuhVersion();
        let serverAddress = false;
        let wazuhPassword = '';
        let hidePasswordInput = false;
        serverAddress = this.configuration['enrollment.dns'] || false;
        if (!serverAddress) {
          serverAddress = await this.props.getCurrentApiAddress();
        }
        let authInfo = await this.getAuthInfo();
        const needsPassword = (authInfo.auth || {}).use_password === 'yes';
        if (needsPassword) {
          wazuhPassword = this.configuration['enrollment.password'] || authInfo['authd.pass'] || '';
          if (wazuhPassword) {
            hidePasswordInput = true;
          }
        }

        const udpProtocol = await this.getRemoteInfo();
        const groups = await this.getGroups();
        this.setState({
          serverAddress,
          needsPassword,
          hidePasswordInput,
          versionButtonsCentosOrRedHat,
          architectureButtons,
          architectureCentos5OrRedHat5,
          wazuhPassword,
          udpProtocol,
          wazuhVersion,
          groups,
          loading: false,
        });
      } catch (error) {
        this.setState({
          wazuhVersion: version,
          loading: false,
        });
        const options = {
          context: `${RegisterAgent.name}.componentDidMount`,
          level: UI_LOGGER_LEVELS.ERROR,
          severity: UI_ERROR_SEVERITIES.BUSINESS,
          display: false,
          store: false,
          error: {
            error: error,
            message: error.message || error,
            title: error.name || error,
          },
        };
        getErrorOrchestrator().handleError(options);
      }
    }

    async getAuthInfo() {
      try {
        const result = await WzRequest.apiReq('GET', '/agents/000/config/auth/auth', {});
        return (result.data || {}).data || {};
      } catch (error) {
        this.setState({ gotErrorRegistrationServiceInfo: true });
        throw new Error(error);
      }
    }

    async getRemoteInfo() {
      try {
        const result = await WzRequest.apiReq('GET', '/agents/000/config/request/remote', {});
        const remote = ((result.data || {}).data || {}).remote || {};
        return (remote[0] || {}).protocol !== 'tcp' && (remote[0] || {}).protocol[0] !== 'TCP';
      } catch (error) {
        throw new Error(error);
      }
    }

    selectOS(os) {
      this.setState({
        selectedOS: os,
        selectedVersion: '',
        selectedArchitecture: '',
        selectedSYS: 'systemd',
      });
    }

    systemSelector() {
      if (this.state.selectedOS === 'rpm') {
        if (this.state.selectedSYS === 'systemd') {
          return 'sudo systemctl daemon-reload\nsudo systemctl enable wazuh-agent\nsudo systemctl start wazuh-agent';
        } else return 'sudo chkconfig --add wazuh-agent\nsudo service wazuh-agent start';
      } else if (this.state.selectedOS === 'deb') {
        if (this.state.selectedSYS === 'systemd') {
          return 'sudo systemctl daemon-reload\nsudo systemctl enable wazuh-agent\nsudo systemctl start wazuh-agent';
        } else return 'sudo update-rc.d wazuh-agent defaults 95 10\nsudo service wazuh-agent start';
      } else return '';
    }

    selectSYS(sys) {
      this.setState({ selectedSYS: sys });
    }

    setServerAddress = (serverAddress) => {
      this.setState({ serverAddress });
    }

    setGroupName = (selectedGroup) => {
      this.setState({ selectedGroup });
    }

    setArchitecture(selectedArchitecture) {
      this.setState({ selectedArchitecture });
    }

    setVersion(selectedVersion) {
      this.setState({ selectedVersion, selectedArchitecture: '' });
    }

    setWazuhPassword(event) {
      this.setState({ wazuhPassword: event.target.value });
    }

    setShowPassword(event) {
      this.setState({ showPassword: event.target.checked });
    }

    obfuscatePassword(text) {
      let obfuscate = '';
      const regex = /WAZUH_REGISTRATION_PASSWORD=?\040?\'(.*?)\'/gm;
      const match = regex.exec(text);
      const password = match[1];
      if (password) {
        [...password].forEach(() => (obfuscate += '*'));
        text = text.replace(password, obfuscate);
      }
      return text;
    }

    async getGroups() {
      try {
        const result = await WzRequest.apiReq('GET', '/groups', {});
        return result.data.data.affected_items.map((item) => ({ label: item.name, id: item.name }));
      } catch (error) {
        throw new Error(error);
      }
    }

    optionalDeploymentVariables() {
      let deployment = `WAZUH_MANAGER='${this.state.serverAddress}' `;

      if (this.state.selectedOS == 'win') {
        deployment += `WAZUH_REGISTRATION_SERVER='${this.state.serverAddress}' `;
      }

      if (this.state.needsPassword) {
        deployment += `WAZUH_REGISTRATION_PASSWORD='${this.state.wazuhPassword}' `;
      }

      if (this.state.udpProtocol) {
        deployment += `WAZUH_PROTOCOL='UDP' `;
      }

      if (this.state.selectedGroup.length) {
        deployment += `WAZUH_AGENT_GROUP='${this.state.selectedGroup
          .map((item) => item.label)
          .join(',')}' `;
      }

      // macos doesnt need = param
      if (this.state.selectedOS === 'macos') {
        return deployment.replace(/=/g, ' ');
      }

      return deployment;
    }

    checkMissingOSSelection() {
      if (!this.state.selectedOS) {
        return ['Operating system'];
      }
      switch (this.state.selectedOS) {
        case 'rpm':
          return [
            ...(!this.state.selectedVersion ? ['OS version'] : []),
            ...(this.state.selectedVersion && !this.state.selectedArchitecture
              ? ['OS architecture']
              : []),
          ];
        case 'deb':
          return [...(!this.state.selectedArchitecture ? ['OS architecture'] : [])];
        default:
          return [];
      }
    }

    getHighlightCodeLanguage(selectedSO) {
      if (selectedSO.toLowerCase() === 'win') {
        return 'powershell';
      } else {
        return 'bash';
      }
    }

    render() {
      const appVersionMajorDotMinor = this.state.wazuhVersion.split('.').slice(0, 2).join('.');
      const urlCheckConnectionDocumentation = webDocumentationLink('user-manual/agents/agent-connection.html', appVersionMajorDotMinor);
      const textAndLinkToCheckConnectionDocumentation = (
        <p>
          To verify the connection with the Wazuh server, please follow this{' '}
          <a href={urlCheckConnectionDocumentation} target="_blank">
            document.
          </a>
        </p>
      );
      const missingOSSelection = this.checkMissingOSSelection();

      const passwordInput = (
        <EuiFieldText
          placeholder="Wazuh password"
          value={this.state.wazuhPassword}
          onChange={(event) => this.setWazuhPassword(event)}
        />
      );

      const codeBlock = {
        zIndex: '100',
      };
      const customTexts = {
        rpmText: `sudo ${this.optionalDeploymentVariables()}yum install ${optionalPackages(this.state.selectedOS, this.state.selectedArchitecture, this.state.wazuhVersion)}`,
        debText: `curl -so wazuh-agent-${this.state.wazuhVersion
          }.deb ${optionalPackages(this.state.selectedOS, this.state.selectedArchitecture, this.state.wazuhVersion)} && sudo ${this.optionalDeploymentVariables()}dpkg -i ./wazuh-agent-${this.state.wazuhVersion
          }.deb`,
        macosText: `curl -so wazuh-agent-${this.state.wazuhVersion
          }.pkg https://packages.wazuh.com/4.x/macos/wazuh-agent-${this.state.wazuhVersion
          }-1.pkg && sudo launchctl setenv ${this.optionalDeploymentVariables()}&& sudo installer -pkg ./wazuh-agent-${this.state.wazuhVersion
          }.pkg -target /`,
        winText: `Invoke-WebRequest -Uri https://packages.wazuh.com/4.x/windows/wazuh-agent-${this.state.wazuhVersion
          }-1.msi -OutFile \${env:tmp}\\wazuh-agent-${this.state.wazuhVersion}.msi; msiexec.exe /i \${env:tmp}\\wazuh-agent-${this.state.wazuhVersion
          }.msi /q ${this.optionalDeploymentVariables()}`,
      };

      const field = `${this.state.selectedOS}Text`;
      const text = customTexts[field];
      const language = this.getHighlightCodeLanguage(this.state.selectedOS);
      const windowsAdvice = this.state.selectedOS === 'win' && (
        <>
          <EuiCallOut
            title="Requirements"
            iconType="iInCircle"
          >
            <ul class="wz-callout-list">
              <li><span>You will need administrator privileges to perform this installation.</span></li>
              <li><span>PowerShell 3.0 or greater is required.</span></li>
            </ul>
            <p>Keep in mind you need to run this command in a Windows PowerShell terminal.</p>
          </EuiCallOut>
          <EuiSpacer></EuiSpacer>
        </>
      );
      const restartAgentCommand = this.restartAgentCommand[this.state.selectedOS];
      const onTabClick = (selectedTab) => {
        this.selectSYS(selectedTab.id);
      };

      const calloutErrorRegistrationServiceInfo = this.state.gotErrorRegistrationServiceInfo ? (
        <EuiCallOut
          color="danger"
          title='This section could not be displayed because you do not have permission to get access to the registration service.'
          iconType="iInCircle"
        />
      ) : null;

      const guide = (
        <div>
          {(this.state.gotErrorRegistrationServiceInfo) ? (
            <EuiCallOut
              color="danger"
              title='This section could not be displayed because you do not have permission to get access to the registration service.'
              iconType="iInCircle"
            />
          ) :
            this.state.selectedOS && (
              <EuiText>
                <p>
                  You can use this command to install and enroll the Wazuh agent in one or more hosts.
                </p>
                <EuiCallOut
                  color="warning"
                  title={
                    <>
                      If the installer finds another Wazuh agent in the system, it will upgrade it preserving the configuration.
                    </>
                  }
                  iconType="iInCircle"
                />
                <EuiSpacer />
                {windowsAdvice}
                <div className="copy-codeblock-wrapper">
                  <EuiCodeBlock style={codeBlock} language={language}>
                    {this.state.wazuhPassword && !this.state.showPassword ? this.obfuscatePassword(text) : text}
                  </EuiCodeBlock>
                  <EuiCopy textToCopy={text}>
                    {(copy) => (
                      <div className="copy-overlay"  onClick={copy}>
                        <p><EuiIcon type="copy"/> Copy command</p>
                      </div>
                    )}
                  </EuiCopy>
                </div>
                {this.state.needsPassword && (
                  <EuiSwitch
                    label="Show password"
                    checked={this.state.showPassword}
                    onChange={(active) => this.setShowPassword(active)}
                  />
                )}
                <EuiSpacer />
              </EuiText>
            )}
        </div>
      );

      const tabs = [
        {
          id: 'systemd',
          name: 'Systemd',
          content: (
            <Fragment>
              <EuiSpacer />
              <EuiText>
                <div className="copy-codeblock-wrapper">
                  <EuiCodeBlock style={codeBlock} language={language}>
                    {this.systemSelector()}
                  </EuiCodeBlock>
                  <EuiCopy textToCopy={this.systemSelector()}>
                    {(copy) => (
                      <div className="copy-overlay" onClick={copy}>
                        <p><EuiIcon type="copy" /> Copy command</p>
                      </div>
                    )}
                  </EuiCopy>
                </div>
                <EuiSpacer size='s'/>
                {textAndLinkToCheckConnectionDocumentation}
              </EuiText>
            </Fragment>
          ),
        },
        {
          id: 'sysV',
          name: 'SysV Init',
          content: (
            <Fragment>
              <EuiSpacer />
              <EuiText>
                <div className="copy-codeblock-wrapper">
                  <EuiCodeBlock style={codeBlock} language={language}>
                    {this.systemSelector()}
                  </EuiCodeBlock>
                  <EuiCopy textToCopy={this.systemSelector()}>
                    {(copy) => (
                      <div className="copy-overlay" onClick={copy}>
                        <p><EuiIcon type="copy" /> Copy command</p>
                      </div>
                    )}
                  </EuiCopy>
                </div>
                <EuiSpacer size='s'/>
                {textAndLinkToCheckConnectionDocumentation}
              </EuiText>
            </Fragment>
          ),
        },
      ];

      const steps = [
        {
          title: 'Choose the Operating system',
          children: (
            <EuiButtonGroup
              color="primary"
              legend="Choose the Operating system"
              options={osButtons}
              idSelected={this.state.selectedOS}
              onChange={(os) => this.selectOS(os)}
            />
          ),
        },
        ...(this.state.selectedOS == 'rpm'
          ? [
            {
              title: 'Choose the version',
              children: (
                <EuiButtonGroup
                  color="primary"
                  legend="Choose the version"
                  options={versionButtonsCentosOrRedHat}
                  idSelected={this.state.selectedVersion}
                  onChange={(version) => this.setVersion(version)}
                />
              ),
            },
          ]
          : []),
        ...(this.state.selectedOS == 'rpm' && this.state.selectedVersion == 'centos5' || this.state.selectedVersion == 'redhat5' 
          ? [
            {
              title: 'Choose the architecture',
              children: (
                <EuiButtonGroup
                  color="primary"
                  legend="Choose the architecture"
                  options={architectureCentos5OrRedHat5}
                  idSelected={this.state.selectedArchitecture}
                  onChange={(architecture) => this.setArchitecture(architecture)}
                />
              ),
            },
          ]
          : []),
        ...(this.state.selectedOS == 'deb' ||
          (this.state.selectedOS == 'rpm' && this.state.selectedVersion == 'centos6' || this.state.selectedVersion == 'redhat6')
          ? [
            {
              title: 'Choose the architecture',
              children: (
                <EuiButtonGroup
                  color="primary"
                  legend="Choose the architecture"
                  options={architectureButtons}
                  idSelected={this.state.selectedArchitecture}
                  onChange={(architecture) => this.setArchitecture(architecture)}
                />
              ),
            },
          ]
          : []),
        {
          title: 'Wazuh server address',
          children: <Fragment><ServerAddress defaultValue={this.state.serverAddress} onChange={this.setServerAddress}/></Fragment>,
        },
        ...(!(!this.state.needsPassword || this.state.hidePasswordInput)
          ? [
            {
              title: 'Wazuh password',
              children: <Fragment>{passwordInput}</Fragment>,
            },
          ]
          : []),
        {
          title: 'Assign the agent to a group',
          children: <Fragment><AgentGroup options={this.state.groups} onChange={this.setGroupName}/></Fragment>,
        },
        {
          title: 'Install and enroll the agent',
          children: this.state.gotErrorRegistrationServiceInfo ?
            calloutErrorRegistrationServiceInfo
            : missingOSSelection.length ? (
              <EuiCallOut
                color="warning"
                title={`Please select the ${missingOSSelection.join(', ')}.`}
                iconType="iInCircle"
              />
            ) : (
              <div>{guide}</div>
            ),
        },
        ...(this.state.selectedOS == 'rpm' || this.state.selectedOS == 'deb'
          ? [
            {
              title: 'Start the agent',
              children: this.state.gotErrorRegistrationServiceInfo ?
                calloutErrorRegistrationServiceInfo
                : missingOSSelection.length ? (
                  <EuiCallOut
                    color="warning"
                    title={`Please select the ${missingOSSelection.join(', ')}.`}
                    iconType="iInCircle"
                  />
                ) : (
                  <EuiTabbedContent
                    tabs={tabs}
                    selectedTab={this.selectedSYS}
                    onTabClick={onTabClick}
                  />
                ),
            },
          ]
          : []),

        ...(!missingOSSelection.length &&
          this.state.selectedOS !== 'rpm' &&
          this.state.selectedOS !== 'deb' &&
          restartAgentCommand
          ? [
            {
              title: 'Start the agent',
              children: this.state.gotErrorRegistrationServiceInfo ?
                calloutErrorRegistrationServiceInfo
                : (
                  <EuiFlexGroup direction="column">
                    <EuiText>
                      <div className="copy-codeblock-wrapper">
                        <EuiCodeBlock style={codeBlock} language={language}>
                          {restartAgentCommand}
                        </EuiCodeBlock>
                        <EuiCopy textToCopy={restartAgentCommand}>
                          {(copy) => (
                            <div className="copy-overlay" onClick={copy}>
                              <p><EuiIcon type="copy" /> Copy command</p>
                            </div>
                          )}
                        </EuiCopy>
                      </div>
                    </EuiText>
                  </EuiFlexGroup>
                ),
            },
          ]
          : []),
      ];
      return (
        <div>
          <EuiPage restrictWidth="1000px" style={{ background: 'transparent' }}>
            <EuiPageBody>
              <EuiFlexGroup>
                <EuiFlexItem>
                  <EuiPanel>
                    <EuiFlexGroup>
                      <EuiFlexItem>
                        <EuiTitle>
                          <h2>Deploy a new agent</h2>
                        </EuiTitle>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        {this.props.hasAgents() && (
                          <EuiButtonEmpty
                            size="s"
                            onClick={() => this.props.addNewAgent(false)}
                            iconType="cross"
                          >
                            Close
                          </EuiButtonEmpty>
                        )}
                        {!this.props.hasAgents() && (
                          <EuiButtonEmpty
                            size="s"
                            onClick={() => this.props.reload()}
                            iconType="refresh"
                          >
                            Refresh
                          </EuiButtonEmpty>
                        )}
                      </EuiFlexItem>
                    </EuiFlexGroup>
                    <EuiSpacer></EuiSpacer>
                    {this.state.loading && (
                      <>
                        <EuiFlexItem>
                          <EuiProgress size="xs" color="primary" />
                        </EuiFlexItem>
                        <EuiSpacer></EuiSpacer>
                      </>
                    )}
                    {!this.state.loading && (
                      <EuiFlexItem>
                        <EuiSteps steps={steps} />
                      </EuiFlexItem>
                    )}
                  </EuiPanel>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiPageBody>
          </EuiPage>
        </div>
      );
    }
  }
);