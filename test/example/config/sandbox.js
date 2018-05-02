var contextPath = '/jsoneditor';

module.exports = {
  application: {
    contextPath: contextPath
  },
  plugins: {
    appHarekeeper: {
      contextPath: '/harekeeper',
      recycler: {
        reportAPI: {
          uri: process.env.DEVEBOT_OPFLOW_URI || 'amqp://localhost',
          subscriberName: 'app-harekeeper-subscriber',
          recyclebinName: 'app-harekeeper-recyclebin',
          applicationId: 'appHarekeeperLab',
          __metadata: {
            description: 'Recyclebin for ReportAPI service'
          }
        }
      }
    },
    appJsoneditor: {
      contextPath: '/jsoneditor',
      descriptors: [
        {
          name: 'harekeeper',
          title: 'HareKeeper: Hares => Rabbits',
          listAction: {
            path: '/harekeeper',
            method: 'GET'
          },
          infoAction: {
            path: '/harekeeper/%DOCUMENT_ID%',
            method: 'GET',
            message: 'Total: %messageCount%'
          },
          loadAction: {
            path: '/harekeeper/%DOCUMENT_ID%/top',
            method: 'GET',
            label: 'Reload',
            value: 'reload',
            description: 'Reload the top message from recyclebin'
          },
          submitAction: {
            path: '/harekeeper/%DOCUMENT_ID%/top',
            method: 'PUT',
            options: [
              {
                label: 'Discard',
                value: 'discard',
                description: 'Delete the current message',
                align: 'left',
                style: 'danger'
              },
              {
                label: 'Requeue',
                value: 'requeue',
                description: 'Move the current message to the end of recyclebin',
                align: 'right',
                style: 'primary'
              },
              {
                label: 'Recover',
                value: 'recover',
                description: 'Move the changed message to the end of main queue',
                align: 'right',
                style: 'success'
              }
            ]
          }
        }
      ]
    },
    appWebweaver: {
      defaultRedirectUrl: contextPath + '/editor' + '/harekeeper/'
    }
  }
};
