import { toast } from "sonner";
import { dismissAppToast, showAppToast } from "./appToast";

vi.mock("sonner", () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn()
  }
}));

const mockedToast = vi.mocked(toast);

describe("appToast", () => {
  beforeEach(() => {
    mockedToast.dismiss.mockReset();
    mockedToast.error.mockReset();
    mockedToast.success.mockReset();
  });

  it("routes success, error, and dismiss through one shared toast API", () => {
    showAppToast({ message: "Saved", status: "success" });
    showAppToast({ id: "provider-test", message: "Failed", status: "error" });
    dismissAppToast("provider-test");

    expect(mockedToast.success).toHaveBeenCalledWith("Saved", {
      duration: 4500,
      id: "app-toast"
    });
    expect(mockedToast.error).toHaveBeenCalledWith("Failed", {
      duration: Infinity,
      id: "provider-test"
    });
    expect(mockedToast.dismiss).toHaveBeenCalledWith("provider-test");
  });
});
