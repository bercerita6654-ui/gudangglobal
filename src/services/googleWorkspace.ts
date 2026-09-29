import { getAccessToken } from './googleAuth';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
}

export async function listDriveSpreadsheets(): Promise<DriveFileItem[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Belum terautentikasi dengan Google Workspace');
  }

  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,webViewLink,modifiedTime)&pageSize=30`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.files || [];
}

export async function getSpreadsheetValues(spreadsheetId: string, range = 'A1:Z500'): Promise<any[][]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Belum terautentikasi dengan Google Workspace');
  }

  const encodedRange = encodeURIComponent(range);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.values || [];
}

export async function updateSpreadsheetValues(spreadsheetId: string, range: string, values: any[][]): Promise<any> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Belum terautentikasi dengan Google Workspace');
  }

  const encodedRange = encodeURIComponent(range);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets Update error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function appendSpreadsheetValues(spreadsheetId: string, range: string, values: any[][]): Promise<any> {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }

  const encodedRange = encodeURIComponent(range);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets Append error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function createSpreadsheet(title: string): Promise<{ id: string; webViewLink: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Belum terautentikasi dengan Google Workspace');
  }

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets Create error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    id: data.spreadsheetId,
    webViewLink: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`
  };
}
