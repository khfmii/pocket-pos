package com.pocketpos.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;

/**
 * Translates short texts (item names) on the phone with Google's on-device ML Kit. Nothing is sent to a translation
 * service: the first use of a language pair downloads its model (about 30 MB each, over any connection) and after that
 * it works offline. Errors are rejected with short codes the web side translates:
 * "unsupported-language", "model-download-failed", "translate-failed".
 */
@CapacitorPlugin(name = "Translate")
public class TranslatePlugin extends Plugin {

    @PluginMethod
    public void translate(PluginCall call) {
        String text = call.getString("text");
        String source = TranslateLanguage.fromLanguageTag(String.valueOf(call.getString("source")));
        String target = TranslateLanguage.fromLanguageTag(String.valueOf(call.getString("target")));
        if (text == null || source == null || target == null) {
            call.reject("unsupported-language");
            return;
        }
        if (source.equals(target)) {
            JSObject same = new JSObject();
            same.put("text", text);
            call.resolve(same);
            return;
        }
        final Translator translator = Translation.getClient(
            new TranslatorOptions.Builder().setSourceLanguage(source).setTargetLanguage(target).build()
        );
        translator
            .downloadModelIfNeeded(new DownloadConditions.Builder().build())
            .addOnSuccessListener(unused ->
                translator
                    .translate(text)
                    .addOnSuccessListener(result -> {
                        JSObject out = new JSObject();
                        out.put("text", result);
                        call.resolve(out);
                        translator.close();
                    })
                    .addOnFailureListener(e -> {
                        call.reject("translate-failed");
                        translator.close();
                    })
            )
            .addOnFailureListener(e -> {
                call.reject("model-download-failed");
                translator.close();
            });
    }
}
