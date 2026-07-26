import {
  assertRealZoomAllowed,
  loadZoomVideoSdkEnv,
} from "./video-sdk-env-loader.mjs";

loadZoomVideoSdkEnv();

if (!assertRealZoomAllowed()) {
  process.exit();
}

console.log(
  JSON.stringify(
    {
      cleanup: "nao_aplicavel",
      message:
        "Teste real ainda exige homologacao manual explicita antes de qualquer ingresso em sessao ou consumo de creditos.",
      realZoomCalled: false,
    },
    null,
    2,
  ),
);
