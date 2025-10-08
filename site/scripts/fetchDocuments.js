import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';

const TARGET_URL = 'https://www.kaa.org.tw/public_list_1.php?t=0&search_input1=&search_input2=&search_input3=&b=1';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchPage() {
  const response = await fetch(TARGET_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseDocuments(html) {
  const $ = load(html);
  const table = $('table').first();
  const rows = table.find('tr').slice(1); // skip header row

  const documents = [];

  rows.each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 4) {
      return;
    }

    const date = $(cells[0]).text().trim();
    const titleCell = $(cells[1]);
    const subjectLink = titleCell.find('a').attr('href');
    const subject = titleCell.find('a').text().trim() || titleCell.text().trim();
    const deadline = $(cells[2]).text().trim();

    const attachments = [];
    $(cells[3])
      .find('a')
      .each((__, link) => {
        const href = $(link).attr('href');
        const label = $(link).text().trim() || '附件';
        if (href) {
          attachments.push({
            label,
            url: new URL(href, TARGET_URL).href,
          });
        }
      });

    documents.push({
      date,
      subject,
      subjectUrl: subjectLink ? new URL(subjectLink, TARGET_URL).href : null,
      deadline,
      attachments,
    });
  });

  return documents;
}

async function writeData(documents) {
  const outDir = path.resolve(__dirname, '../public/data');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'documents.json');
  await fs.writeFile(outPath, JSON.stringify({ documents, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  return outPath;
}

async function main() {
  try {
    const html = await fetchPage();
    const documents = parseDocuments(html);
    const outPath = await writeData(documents);
    console.log(`Saved ${documents.length} documents to ${outPath}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

main();
