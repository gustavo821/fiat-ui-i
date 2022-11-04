import { Button } from "@nextui-org/react";
import {useTheme} from "next-themes";
import toast, { ToastBar, Toaster } from "react-hot-toast";
export const CustomToaster = () => {
  const theme = useTheme()

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          minWidth: "250px",
          backgroundColor: theme.resolvedTheme === 'dark' ? '#010101' : '#ffffff',
          color: theme.resolvedTheme === 'dark' ? '#ffffff' : '#000000',
        },
      }}
    >
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              {icon}
              {message}
              {t.type !== "loading" && (
                <Button
                  auto
                  style={{ backgroundColor: "transparent", color: theme.resolvedTheme === 'dark' ? '#ffffff' : '#000000' }}
                  onClick={() => toast.dismiss(t.id)}
                >
                  X
                </Button>
              )}
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
};
