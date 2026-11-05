DeepFilterNet3 networks (enc.onnx, erb_dec.onnx, df_dec.onnx), unmodified, from
models/DeepFilterNet3_onnx.tar.gz in https://github.com/Rikorose/DeepFilterNet
(commit d375b2d8309e0935d165700c91da9de862a99c31, 2024-10-17;
archive sha256 c94d91f70911001c946e0fabb4aa9adc37045f45a03b56008cb0c8244cb63616).
Author: Hendrik Schröter. License: MIT or Apache-2.0, at your option (LICENSE-MIT, LICENSE-APACHE in this folder).
Model settings (config.ini in the archive): 48 kHz, FFT 960, hop 480, 32 ERB bands, deep filter on 96 bins,
order 5, lookahead 2. The signal path around the networks is dfn-core.js (written for this app).
Used only when the singer turns on POLISH > CLEAN > AI clean. Runs on the device with ONNX Runtime Web (vendor/ort).
