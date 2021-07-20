import { LabIcon } from '@jupyterlab/ui-components';

//template
// export const fooIcon = new LabIcon({
//     name: 'barpkg:foo',
//     svgstr: '<svg>...</svg>'
// });

export const CommentsHubIcon = new LabIcon({
  name: 'CommentsHubIcon',
  svgstr: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="20" height="20" fill="jp-icon3"/>
    <circle cx="10" cy="10" r="9.25" stroke="#616161" stroke-width="1.5"/> 
    <path d="M9.74422 1C6.16412 4 1.15198 11.8 9.74422 19M10.2558 1C13.8359 4 18.848 11.8 10.2558 19" stroke="#616161" stroke-width="1.5"/>  
    <path d="M19 9.84653C16 7.69847 8.2 4.69119 1 9.84653M19 10.1535C16 12.3015 8.2 15.3088 1 10.1535" stroke="#616161" stroke-width="1.5"/> 
    <path d="M10 1V19" stroke="#616161" stroke-width="1.5"/>
    </svg>`
});

export const CommentsPanelIcon = new LabIcon({
  name: 'CommentsPanelIcon',
  svgstr: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="18" height="18" fill="white"/>
  <g clip-path="url(#clip0)">
    <path d="M17.25 2.4C17.25 1.96239 17.0762 1.54271 16.7667 1.23327C16.4573 0.923839 16.0376 0.75 15.6 0.75L2.4 0.75C1.96239 0.75 1.54271 0.923839 1.23327 1.23327C0.923839 1.54271 0.75 1.96239 0.75 2.4L0.75 12.3C0.75 12.7376 0.923839 13.1573 1.23327 13.4667C1.54271 13.7762 1.96239 13.95 2.4 13.95H13.95L17.25 17.25V2.4ZM13.95 10.65H4.05V9H13.95V10.65ZM13.95 8.175H4.05V6.525H13.95V8.175ZM13.95 5.7H4.05V4.05H13.95V5.7Z" fill="#616161"/>
    <rect x="0.75" y="12" width="16.5" height="2.25" fill="#616161"/><rect x="0.75" y="0.75" width="16.5" height="2.25" fill="#616161"/>
  </g>
  <defs>
    <clipPath id="clip0"><rect width="16.5" height="16.5" fill="white" transform="translate(0.75 0.75)"/>
    </clipPath>
  </defs>
  </svg>`
});

export const CreateCommentIcon = new LabIcon({
  name: 'CreateCommentIcon',
  svgstr: `<svg width="20" height="20" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.6299 7.81347L11.1299 5.22651C10.9935 5.0854 10.8117 4.99133 10.5844 4.99133H6.62986C6.26622 5.03837 5.90259 5.41465 5.90259 5.83797V12.47C5.90259 12.8933 6.22077 13.2226 6.62986 13.2226H13.0844C13.4935 13.2226 13.8117 12.8933 13.8117 12.47V8.37789C13.8571 8.14272 13.7662 7.95457 13.6299 7.81347ZM10.9935 6.26129L12.539 7.95457H10.9935V6.26129V6.26129ZM12.7662 12.2348H6.9935C6.94804 12.2348 6.90259 12.2348 6.90259 12.1407V6.16722C6.90259 6.07315 6.94804 6.02612 6.9935 6.02612H10.2662V8.09568C10.2662 8.09568 10.2662 8.47197 10.4026 8.61307C10.539 8.75418 10.9026 8.75418 10.9026 8.75418H12.8571V12.1407C12.8571 12.1407 12.8117 12.2348 12.7662 12.2348Z" fill="jp-icon3"/>
    <g clip-path="url(#clip0)">
    <path d="M16.9999 17.2609L13.8571 14.0087H2.85707C2.4403 14.0087 2.04061 13.8374 1.74591 13.5324C1.45121 13.2275 1.28564 12.8139 1.28564 12.3826L1.28564 2.62609C1.28564 2.19482 1.45121 1.78122 1.74591 1.47627C2.04061 1.17132 2.4403 1 2.85707 1H15.4285C15.8453 1 16.245 1.17132 16.5397 1.47627C16.8344 1.78122 16.9999 2.19482 16.9999 2.62609V17.2609ZM5.27707 6.50159V7.58565H8.61898V11.0546H9.6666V7.58565H13.019V6.50159H9.6666V3.03261H8.61898V6.50159H5.27707Z" fill="#616161"/>
    <rect x="1.28564" y="12.0869" width="15.7143" height="2.21739" fill="#616161"/>
    <rect x="1.28564" y="1" width="15.7143" height="2.21739" fill="#616161"/>
    </g>
    <defs>
    <clipPath id="clip0">
    <rect width="15.7143" height="16.2609" fill="white" transform="translate(1.28564 1)"/>
    </clipPath>
    </defs>
    </svg>
    `
});
