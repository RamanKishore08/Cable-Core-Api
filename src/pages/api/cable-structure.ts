import { NextApiRequest, NextApiResponse } from "next";
import puppeteer, { Browser } from "puppeteer-core";
import { executablePath } from "puppeteer";

let browser: Browser | null = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const data = req.body;

    if (!data || !data.processName) {
      return res
        .status(400)
        .json({ error: "Missing required field: processName" });
    }

    const validProcesses = [
      "WireDrawing",
      "Stranding",
      "Laying",
      "Extrusion",
      "Bedding",
      "Sheathing",
      "Armouring",
    ];

    if (!validProcesses.includes(data.processName)) {
      return res.status(400).json({
        error: `Invalid processName: '${data.processName}'. Expected one of: ${validProcesses.join(", ")}.`,
      });
    }

    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      const url = `http://localhost:3000/svg-render?data=${encodeURIComponent(
        JSON.stringify(data)
      )}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
      await page.waitForSelector("svg", { timeout: 5000 }); // Wait for SVG to load (5 seconds)

      const svgContent = await page.evaluate(() => {
        const svg = document.querySelector("svg");
        return svg ? svg.outerHTML : null;
      });

      if (!svgContent) {
        throw new Error("SVG not found");
      }

      // Set the response content type to HTML to prevent the browser from rendering it as an image
      res.setHeader("Content-Type", "text/html");
      res.status(200).send(svgContent); // Return the raw SVG content as HTML

    } catch (error) {
      console.error("Error capturing SVG:", error);
      res.status(500).json({ error: "Failed to generate SVG" });
    } finally {
      await page.close(); // Close only the page, not the browser
    }
  } catch (err) {
    console.error("Error handling request:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
