import { Awareness } from 'y-protocols/awareness';
import { IIdentity } from './commentformat';
import { getAnonymousUserName, getRandomColor } from '@jupyterlab/docprovider';

export const emptyIdentity: IIdentity = {
  id: 0,
  name: 'User',
  color: ''
};

let count = -1;
export function randomIdentity(): IIdentity {
  return {
    id: count--,
    name: getAnonymousUserName(),
    color: getRandomColor()
  };
}

export function setIdentityName(awareness: Awareness, name: string): number{
  let localState = awareness.getLocalState();
  if (localState == null ) {
    return 0;
  }
  const oldUser = localState['user'];
  if (oldUser == null){
    return 1 ;
  }
  let newUser = {
    'name': name,
    'color': oldUser['color'],
  }
  awareness.setLocalStateField('user', newUser);

  localState = awareness.getLocalState();
  if (localState == null ) {
    return 2;
  }
  if (localState['user']['name'] != name){
    return 3;
  } 
  return 4;
}

export function getIdentity(awareness: Awareness): IIdentity {
  const localState = awareness.getLocalState();
  if (localState == null) {
    return emptyIdentity;
  }

  const userInfo = localState['user'];
  if (userInfo != null && 'name' in userInfo && 'color' in userInfo) {
    return {
      id: awareness.clientID,
      name: userInfo['name'],
      color: userInfo['color']
    };
  }

  return randomIdentity();
}

export function getCommentTimeString(): string {
  const d = new Date();
  const time = d.toLocaleString('default', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  });
  const date = d.toLocaleString('default', {
    month: 'short',
    day: 'numeric'
  });
  return time + ' ' + date;
}

//function that converts a line-column pairing to an index
export function lineToIndex(str: string, line: number, col: number): number {
  if (line == 0) {
    return col;
  } else {
    let arr = str.split('\n');
    return arr.slice(0, line).join('\n').length + col + 1;
  }
}
