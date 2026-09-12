exports.handler = async function (event) {
  let filename = 'liste_eleves.xlsx';
  let base64Data = '';

  const pathParts = (event.path || '').split('/');
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart && lastPart.includes('.')) {
    filename = decodeURIComponent(lastPart);
  } else if (event.queryStringParameters && event.queryStringParameters.filename) {
    filename = event.queryStringParameters.filename;
  }

  let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (filename.endsWith('.pdf')) {
    contentType = 'application/pdf';
  } else if (filename.endsWith('.csv')) {
    contentType = 'text/csv; charset=utf-8';
  }

  if (event.httpMethod === 'POST') {
    if (event.headers['content-type'] && event.headers['content-type'].includes('application/json')) {
      try {
        const json = JSON.parse(event.body || '{}');
        if (json.filename) filename = json.filename;
        if (json.data) base64Data = json.data;
      } catch (e) {}
    } else {
      const body = event.body || '';
      const params = new URLSearchParams(body);
      if (params.get('filename')) filename = params.get('filename');
      if (params.get('data')) base64Data = params.get('data');
    }
  } else if (event.queryStringParameters && event.queryStringParameters.data) {
    base64Data = event.queryStringParameters.data;
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    },
    body: base64Data,
    isBase64Encoded: true
  };
};
