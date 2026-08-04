import { describe, it, expect } from "vitest";
import { disabledVirusScanProvider } from "./disabled.provider";

describe("disabledVirusScanProvider", () => {
  it("always reports clean, without ever inspecting the buffer", async () => {
    const result = await disabledVirusScanProvider.scan(Buffer.from("anything at all"));
    expect(result).toEqual({ status: "clean" });
  });

  it("reports clean even for a buffer containing the EICAR test signature", async () => {
    const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    const result = await disabledVirusScanProvider.scan(eicar);
    expect(result).toEqual({ status: "clean" });
  });
});
