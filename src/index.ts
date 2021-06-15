import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupyterlab-chat extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-chat:plugin',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab-chat is activated!');
  }
};

export default plugin;
