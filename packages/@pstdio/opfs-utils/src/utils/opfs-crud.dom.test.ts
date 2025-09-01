/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { setupTestOPFS } from "../__helpers__/test-opfs";
import { downloadFile, writeFile } from "./opfs-crud";

describe("opfs-crud downloadFile (jsdom)", () => {
  it("creates an object URL and clicks a link", async () => {
    setupTestOPFS();

    await writeFile("d1/file.txt", "payload");

    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(HTMLElement.prototype, "remove");

    await downloadFile("d1/file.txt");

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:fake");

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
