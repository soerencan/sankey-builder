import { readFile } from "node:fs/promises";
import type { Download, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function downloadBytes(download: Download): Promise<Buffer> {
	const path = await download.path();
	if (!path) throw new Error("Download has no local file");
	return readFile(path);
}

async function exportDiagram(page: Page, format: "SVG" | "PNG"): Promise<Download> {
	await page.getByRole("button", { name: "Export diagram", exact: true }).click();
	const pending = page.waitForEvent("download");
	await page.getByRole("button", { name: format, exact: true }).click();
	return pending;
}

test("downloads JSON and imports it through the file chooser", async ({ page }) => {
	await page.goto("./");
	await page.getByRole("textbox", { name: "Name for Salary", exact: true }).fill("Exported wages");
	const pending = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export JSON", exact: true }).click();
	const download = await pending;
	expect(download.suggestedFilename()).toBe("sankey.json");
	const data = await downloadBytes(download);
	await page.getByRole("textbox", { name: "Name for Exported wages", exact: true }).fill("Changed");
	const chooser = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "Import JSON", exact: true }).click();
	await (await chooser).setFiles({
		name: "sankey.json",
		mimeType: "application/json",
		buffer: data,
	});
	await expect(
		page.getByRole("textbox", { name: "Name for Exported wages", exact: true }),
	).toHaveValue("Exported wages");
});

for (const theme of ["Light", "Dark"]) {
	test(`SVG and PNG render transparent diagrams with gradients in ${theme}`, async ({ page }) => {
		await page.goto("./");
		await page.getByRole("button", { name: "Theme: System", exact: true }).click();
		await page.getByRole("button", { name: theme, exact: true }).click();
		await page.getByRole("button", { name: "Appearance", exact: true }).click();
		await page.getByRole("combobox", { name: "Link colors" }).selectOption("gradient");
		await page.getByRole("button", { name: "Close", exact: true }).click();
		const svgDownload = await exportDiagram(page, "SVG");
		expect(svgDownload.suggestedFilename()).toBe("sankey.svg");
		const xml = (await downloadBytes(svgDownload)).toString("utf8");
		const pngDownload = await exportDiagram(page, "PNG");
		expect(pngDownload.suggestedFilename()).toBe("sankey.png");
		const png = (await downloadBytes(pngDownload)).toString("base64");
		const rendered = await page.evaluate(
			async ({ xml, png }) => {
				const svgDocument = new DOMParser().parseFromString(xml, "image/svg+xml");
				if (svgDocument.querySelector("parsererror"))
					throw new Error("Exported SVG is invalid XML");
				const path = svgDocument.querySelector("path");
				if (!path) throw new Error("Exported SVG has no link path");
				const samples = [0.25, 0.75].map((fraction) =>
					path.getPointAtLength(path.getTotalLength() * fraction),
				);
				async function pixels(source: string) {
					const image = new Image();
					image.src = source;
					await image.decode();
					const canvas = document.createElement("canvas");
					canvas.width = image.naturalWidth;
					canvas.height = image.naturalHeight;
					const context = canvas.getContext("2d", { willReadFrequently: true });
					if (!context) throw new Error("Canvas 2D is unavailable");
					context.drawImage(image, 0, 0);
					const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
					let painted = 0;
					let translucent = 0;
					let labelPixels = 0;
					for (let index = 0; index < data.length; index += 4) {
						const alpha = data[index + 3];
						if (alpha > 0) painted++;
						if (alpha >= 120 && alpha <= 135) translucent++;
						if (
							alpha > 200 &&
							Math.max(data[index], data[index + 1], data[index + 2]) -
								Math.min(data[index], data[index + 1], data[index + 2]) <
								30
						) {
							labelPixels++;
						}
					}
					return {
						width: canvas.width,
						height: canvas.height,
						cornerAlpha: data[3],
						painted,
						translucent,
						labelPixels,
						gradientSamples: samples.map(({ x, y }) =>
							Array.from(
								context.getImageData(
									Math.round((x * canvas.width) / 853),
									Math.round((y * canvas.height) / 480),
									1,
									1,
								).data,
							),
						),
					};
				}
				return {
					svg: await pixels(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`),
					png: await pixels(`data:image/png;base64,${png}`),
					labelColor: svgDocument.querySelector("text")?.getAttribute("fill"),
					gradients: svgDocument.querySelectorAll("linearGradient").length,
				};
			},
			{ xml, png },
		);
		expect(rendered.svg).toMatchObject({ width: 853, height: 480, cornerAlpha: 0 });
		expect(rendered.png).toMatchObject({ width: 1706, height: 960, cornerAlpha: 0 });
		for (const output of [rendered.svg, rendered.png]) {
			expect(output.painted).toBeGreaterThan(1000);
			expect(output.translucent).toBeGreaterThan(1000);
			expect(output.labelPixels).toBeGreaterThan(50);
			const [start, end] = output.gradientSamples;
			expect(start[3]).toBeGreaterThanOrEqual(120);
			expect(end[3]).toBeGreaterThanOrEqual(120);
			expect(
				start
					.slice(0, 3)
					.reduce((difference, channel, index) => difference + Math.abs(channel - end[index]), 0),
			).toBeGreaterThan(20);
		}
		expect(rendered.gradients).toBe(5);
		expect(rendered.labelColor).toBe(theme === "Light" ? "rgb(13, 15, 18)" : "rgb(248, 249, 250)");
	});
}
