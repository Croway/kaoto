package io.kaoto.kompanion.model;

import com.fasterxml.jackson.databind.JsonNode;
import org.eclipse.microprofile.openapi.annotations.media.Schema;

/** Response body for a completed or pending command. */
public record CommandResult(
        String correlationId,
        String status, // "acked", "failed", "pending"
        boolean success,
        String detail,

        @Schema(
                description =
                        "What the worker answered, when it has more than a status: the result of a camel-cli-connector action (e.g. the exchangeId and reply of a send)")
        JsonNode result) {

    public static CommandResult pending(String correlationId) {
        return new CommandResult(correlationId, "pending", false, null, null);
    }

    public static CommandResult acked(String correlationId, boolean success, String detail) {
        return acked(correlationId, success, detail, null);
    }

    public static CommandResult acked(String correlationId, boolean success, String detail, JsonNode result) {
        return new CommandResult(correlationId, success ? "acked" : "failed", success, detail, result);
    }
}
