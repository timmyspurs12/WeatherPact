const { chromium } = require('/tmp/weatherpact-portal-probe/node_modules/playwright-core');

const origin = 'https://portal.genlayer.foundation';
const result = {
  pages: [],
  scriptFindings: [],
  apiResponses: [],
  errors: [],
};
const capturedScripts = new Set();

function publicText(value) {
  return String(value ?? '')
    .replaceAll('\u0000', '')
    .trim();
}

async function summarize(page, label) {
  const summary = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    bodyText: document.body?.innerText?.slice(0, 18_000) ?? '',
    links: [...document.querySelectorAll('a')]
      .map((anchor) => ({ text: anchor.innerText.trim(), href: anchor.href }))
      .filter((item) => item.text || item.href),
    buttons: [...document.querySelectorAll('button')]
      .map((button) => button.innerText.trim())
      .filter(Boolean),
    forms: [...document.querySelectorAll('form')].map((form) => ({
      action: form.action,
      method: form.method,
      fields: [...form.querySelectorAll('input, textarea, select')].map((field) => ({
        tag: field.tagName,
        type: field.getAttribute('type'),
        name: field.getAttribute('name'),
        id: field.id,
        required: field.required,
        placeholder: field.getAttribute('placeholder'),
        maxLength: field.getAttribute('maxlength'),
      })),
    })),
  }));
  result.pages.push({ label, ...summary });
  const scriptUrls = await page.evaluate(() =>
    [...document.scripts].map((script) => script.src).filter(Boolean),
  );
  for (const url of [...new Set(scriptUrls)]) {
    if (capturedScripts.has(url)) continue;
    capturedScripts.add(url);
    try {
      const response = await fetch(url);
      const source = await response.text();
      result.scriptFindings.push(...findInSource(source, url));
    } catch (error) {
      result.errors.push({ script: url, error: String(error) });
    }
  }
  return summary;
}

function findInSource(source, url) {
  const findings = [];
  const exactNeedles = [
    'Project Explorer application',
    'expected verification outcome',
    'Expected verification outcome',
    'How to verify',
    'contract explorer',
    'Contract address',
    'contract address',
    'one-liner',
    'project application',
    'project-application',
    'project_submission',
    'submit-project',
    'submitProject',
  ];
  for (const needle of exactNeedles) {
    let start = 0;
    let count = 0;
    while (count < 5) {
      const index = source.toLowerCase().indexOf(needle.toLowerCase(), start);
      if (index < 0) break;
      findings.push({
        url,
        needle,
        snippet: source.slice(Math.max(0, index - 350), index + needle.length + 650),
      });
      start = index + needle.length;
      count += 1;
    }
  }
  const routeMatches = source.match(/["'`](\/(?:builders|api)\/[^"'`\s]{1,180})["'`]/g) ?? [];
  const routes = [...new Set(routeMatches.map((match) => match.slice(1, -1)))].filter((route) =>
    /project|application|contribution|submission|explorer/i.test(route),
  );
  if (routes.length) findings.push({ url, routes: routes.slice(0, 100) });
  return findings;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: false });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.on('response', (response) => {
      const url = response.url();
      if (url.startsWith(origin) && ['xhr', 'fetch'].includes(response.request().resourceType())) {
        result.apiResponses.push({ status: response.status(), url });
      }
    });

    await page.goto(`${origin}/builders`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const builderPage = await summarize(page, 'Builders landing');

    const becomeBuilder = page
      .getByRole('link', { name: /Become a Builder/i })
      .or(page.getByRole('button', { name: /Become a Builder/i }));
    if ((await becomeBuilder.count()) > 0) {
      await becomeBuilder.first().click();
      await page.waitForTimeout(2_000);
      await summarize(page, 'After Become a Builder (no authentication attempted)');
    } else {
      result.errors.push({ navigation: 'Become a Builder control not found' });
    }

    await page.goto(`${origin}/builders/explorer`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);
    const explorerPage = await summarize(page, 'Project Explorer');
    const applicationLinks = [...builderPage.links, ...explorerPage.links].filter(
      (item) =>
        item.href.startsWith(origin) &&
        /apply|submit|application|contribution/i.test(`${item.text} ${item.href}`),
    );
    for (const item of applicationLinks.slice(0, 5)) {
      await page.goto(item.href, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1_500);
      await summarize(page, `Discovered application link: ${item.text || item.href}`);
    }

    const discoveredRoutes = result.scriptFindings
      .flatMap((finding) => finding.routes ?? [])
      .filter(
        (route, index, all) =>
          all.indexOf(route) === index &&
          route.startsWith('/builders/') &&
          /application|submission|submit|contribution/i.test(route) &&
          !/[{}]/.test(route),
      );
    for (const route of discoveredRoutes.slice(0, 5)) {
      await page.goto(new URL(route, origin).href, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1_500);
      await summarize(page, `Discovered client route: ${route}`);
    }
  } catch (error) {
    result.errors.push({ fatal: String(error), stack: error?.stack });
  } finally {
    await browser.close();
  }

  result.apiResponses = result.apiResponses.filter(
    (item, index, all) =>
      all.findIndex((other) => other.url === item.url && other.status === item.status) === index,
  );
  const encoded = Buffer.from(JSON.stringify(result, null, 2), 'utf8').toString('base64');
  const chunkSize = 3_000;
  const chunks = Math.ceil(encoded.length / chunkSize);
  for (let index = 0; index < chunks; index += 1) {
    console.log(
      `::notice title=Portal discovery base64 (${index + 1}/${chunks})::${encoded.slice(index * chunkSize, (index + 1) * chunkSize)}`,
    );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
