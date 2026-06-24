import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from '../log';
import { engineInstallDir, type HermesEngineAppliedPatch, type HermesEnginePin } from './engine';
import { managedHermesSetupError } from './errors';

interface ManagedHermesEnginePatch {
    edits: ManagedHermesEnginePatchEdit[];
    id: string;
}

interface ManagedHermesEnginePatchEdit {
    find: string | string[];
    replace: string;
    target: string;
}

const managedHermesEnginePatches: ManagedHermesEnginePatch[] = [
    {
        edits: [
            {
                find: [
                    `                kw = {"session_db": session_db}
                if resume_sid := current.get("resume_session_id"):
                    kw["session_id"] = resume_sid
                # Model/effort/fast the desktop picked for a brand-new chat ride
                # in as per-session overrides so the first build uses them
                # directly (no global config, no build-then-switch).
                if override := current.get("model_override"):
                    kw["model_override"] = override
                if (reasoning := current.get("create_reasoning_override")) is not None:
                    kw["reasoning_config_override"] = reasoning
                if (tier := current.get("create_service_tier_override")) is not None:
                    kw["service_tier_override"] = tier
                agent = _make_agent(sid, key, **kw)
            finally:
                _clear_session_context(tokens)

            # Session DB row deferred to first run_conversation() call.
            # pending_title applied post-first-message (see cli.exec handler).
            current["agent"] = agent
            # Baseline for the per-turn config sync; the profile home
            # override is still active here.
            current["config_model_seen"] = _config_model_target()
`,
                    `                kw = {"session_db": session_db}
                if resume_sid := current.get("resume_session_id"):
                    kw["session_id"] = resume_sid
                # Model/effort/fast the desktop picked for a brand-new chat ride
                # in as per-session overrides so the first build uses them
                # directly (no global config, no build-then-switch).
                if override := current.get("model_override"):
                    kw["model_override"] = override
                if (reasoning := current.get("create_reasoning_override")) is not None:
                    kw["reasoning_config_override"] = reasoning
                if (tier := current.get("create_service_tier_override")) is not None:
                    kw["service_tier_override"] = tier
                agent = _make_agent(sid, key, **kw)
            finally:
                _clear_session_context(tokens)

            # Session DB row deferred to first run_conversation() call.
            # pending_title applied post-first-message (see cli.exec handler).
            current["agent"] = agent
            if not current.get("model_override"):
                try:
                    _cfg_model, _cfg_provider = _config_model_target()
                    if _cfg_model:
                        from hermes_cli.model_switch import switch_model as _resolve_model_switch

                        _switch_result = _resolve_model_switch(
                            raw_input=_cfg_model,
                            current_provider=getattr(agent, "provider", "") or _cfg_provider,
                            current_model=getattr(agent, "model", "") or _cfg_model,
                            current_base_url=getattr(agent, "base_url", "") or "",
                            current_api_key=getattr(agent, "api_key", "") or "",
                            is_global=False,
                            explicit_provider=_cfg_provider,
                        )
                        if _switch_result.success:
                            agent.switch_model(
                                new_model=_switch_result.new_model,
                                new_provider=_switch_result.target_provider,
                                api_key=_switch_result.api_key,
                                base_url=_switch_result.base_url,
                                api_mode=_switch_result.api_mode,
                            )
                            current["model_override"] = {
                                "model": _switch_result.new_model,
                                "provider": _switch_result.target_provider,
                                "base_url": _switch_result.base_url,
                                "api_key": _switch_result.api_key,
                                "api_mode": _switch_result.api_mode,
                            }
                            _persist_live_session_runtime(current)
                            _persist_live_session_system_prompt(current)
                            _append_model_switch_marker(
                                current,
                                model=_switch_result.new_model,
                                provider=_switch_result.target_provider,
                            )
                except Exception:
                    logger.debug("failed to apply configured model runtime at build", exc_info=True)
            # Baseline for the per-turn config sync; the profile home
            # override is still active here.
            current["config_model_seen"] = _config_model_target()
`,
                ],
                replace: `                kw = {"session_db": session_db}
                if resume_sid := current.get("resume_session_id"):
                    kw["session_id"] = resume_sid
                _configured_model_runtime = None
                # Model/effort/fast the desktop picked for a brand-new chat ride
                # in as per-session overrides so the first build uses them
                # directly (no global config, no build-then-switch).
                if override := current.get("model_override"):
                    kw["model_override"] = override
                else:
                    try:
                        _cfg_model, _cfg_provider = _config_model_target()
                        if _cfg_model:
                            from hermes_cli.runtime_provider import (
                                resolve_runtime_provider as _resolve_runtime_provider,
                            )

                            _runtime = _resolve_runtime_provider(
                                requested=_cfg_provider or None,
                                target_model=_cfg_model,
                            )
                            _configured_model_runtime = {
                                "model": _cfg_model,
                                "provider": _runtime.get("provider") or _cfg_provider,
                                "base_url": _runtime.get("base_url") or "",
                                "api_key": _runtime.get("api_key") or "",
                                "api_mode": _runtime.get("api_mode") or "",
                            }
                            kw["model_override"] = _configured_model_runtime
                    except Exception:
                        logger.debug("failed to resolve configured model runtime at build", exc_info=True)
                if (reasoning := current.get("create_reasoning_override")) is not None:
                    kw["reasoning_config_override"] = reasoning
                if (tier := current.get("create_service_tier_override")) is not None:
                    kw["service_tier_override"] = tier
                agent = _make_agent(sid, key, **kw)
            finally:
                _clear_session_context(tokens)

            # Session DB row deferred to first run_conversation() call.
            # pending_title applied post-first-message (see cli.exec handler).
            current["agent"] = agent
            if _configured_model_runtime:
                _persist_live_session_runtime(current)
                _persist_live_session_system_prompt(current)
                _append_model_switch_marker(
                    current,
                    model=getattr(agent, "model", "") or _configured_model_runtime["model"],
                    provider=getattr(agent, "provider", "") or _configured_model_runtime["provider"],
                )
            # Baseline for the per-turn config sync; the profile home
            # override is still active here.
            current["config_model_seen"] = _config_model_target()
`,
                target: 'tui_gateway/server.py',
            },
        ],
        id: 'gateway-default-model-runtime',
    },
];

export const managedHermesEnginePatchManifest = managedHermesEnginePatches.map(toAppliedPatch);

export function areManagedHermesEnginePatchesCurrent(
    patches: readonly HermesEngineAppliedPatch[] | null | undefined
): boolean {
    if (!patches || patches.length !== managedHermesEnginePatchManifest.length) {
        return false;
    }
    const byId = new Map(patches.map((patch) => [patch.id, patch.checksum]));
    return managedHermesEnginePatchManifest.every((patch) => byId.get(patch.id) === patch.checksum);
}

export async function applyManagedHermesEnginePatches(
    pin: HermesEnginePin
): Promise<HermesEngineAppliedPatch[]> {
    for (const patch of managedHermesEnginePatches) {
        await applyManagedHermesEnginePatch(pin, patch);
    }
    return managedHermesEnginePatchManifest;
}

async function applyManagedHermesEnginePatch(
    pin: HermesEnginePin,
    patch: ManagedHermesEnginePatch
) {
    for (const edit of patch.edits) {
        await applyManagedHermesEnginePatchEdit(pin, patch, edit);
    }
}

async function applyManagedHermesEnginePatchEdit(
    pin: HermesEnginePin,
    patch: ManagedHermesEnginePatch,
    edit: ManagedHermesEnginePatchEdit
) {
    const targetPath = path.join(engineInstallDir(pin), edit.target);
    let source: string;
    try {
        source = await fs.readFile(targetPath, 'utf8');
    } catch (error) {
        throw managedHermesSetupError(
            `Tavern could not apply managed agent engine patch "${patch.id}" because ${targetPath} could not be read: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }

    if (source.includes(edit.replace)) {
        return;
    }
    const findText = (Array.isArray(edit.find) ? edit.find : [edit.find]).find((candidate) =>
        source.includes(candidate)
    );
    if (!findText) {
        throw managedHermesSetupError(
            `Tavern could not apply managed agent engine patch "${patch.id}" because ${targetPath} no longer matches the expected source. ` +
                'Upgrade or remove the live patch before starting the managed engine.'
        );
    }

    await fs.writeFile(targetPath, source.replace(findText, edit.replace));
    log.info('Applied managed agent engine patch', {
        id: patch.id,
        target: edit.target,
    });
}

function toAppliedPatch(patch: ManagedHermesEnginePatch): HermesEngineAppliedPatch {
    return {
        checksum: crypto.createHash('sha256').update(JSON.stringify(patch)).digest('hex'),
        id: patch.id,
    };
}
