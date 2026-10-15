import { Volume2, Waves, Mic, AudioLines, Download } from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { Section, Slider, Toggle, Button } from '../ui/primitives';

export default function AudioPanel({ clip }) {
  const updateDeep = useEditorStore((s) => s.updateClipDeep);
  const asset = useEditorStore((s) => s.assets.find((a) => a.id === clip.assetId));
  const extractAudio = useEditorStore((s) => s.extractAudio);
  const saveClipAudio = useEditorStore((s) => s.saveClipAudio);
  const a = clip.audio;
  const k = (p) => `aud:${clip.id}:${p}`;
  const maxFade = Math.max(0.1, Math.min(5, clip.duration / 2));
  return (
    <>
      <Section title="Áudio" icon={Volume2}>
        <Toggle checked={a.muted} onChange={(muted) => updateDeep(clip.id, 'audio', { muted })} label="Silenciar (Mute)" />
        <Slider label="Volume" value={Math.round(a.volume * 100)} min={0} max={200} suffix="%" disabled={a.muted} onChange={(v) => updateDeep(clip.id, 'audio', { volume: v / 100 }, k('vol'))} onReset={() => updateDeep(clip.id, 'audio', { volume: 1 })} />
        <div className="grid grid-cols-2 gap-3">
          <Slider label="Fade in" value={Math.min(a.fadeIn, maxFade)} min={0} max={maxFade} step={0.1} suffix="s" format={(v) => v.toFixed(1)} onChange={(v) => updateDeep(clip.id, 'audio', { fadeIn: v }, k('fi'))} />
          <Slider label="Fade out" value={Math.min(a.fadeOut, maxFade)} min={0} max={maxFade} step={0.1} suffix="s" format={(v) => v.toFixed(1)} onChange={(v) => updateDeep(clip.id, 'audio', { fadeOut: v }, k('fo'))} />
        </div>
      </Section>
      {asset && (asset.src || asset.synth) && (
        <Section title={clip.kind === 'video' ? 'Extrair áudio do vídeo' : 'Exportar áudio'} icon={AudioLines}>
          {clip.kind === 'video' && (
            <>
              <p className="text-[11px] text-ink-300 leading-snug">Separa o som deste vídeo numa faixa de áudio própria na timeline (o vídeo fica mudo), para editar, cortar ou trocar a voz/música independentemente.</p>
              <Button icon={AudioLines} variant="primary" className="w-full" onClick={() => extractAudio(clip.id)}>Extrair áudio para a timeline</Button>
            </>
          )}
          <Button icon={Download} className="w-full" onClick={() => saveClipAudio(clip.id)}>Salvar áudio (.wav)</Button>
        </Section>
      )}
      <Section title="Redução de Ruído" icon={Waves}>
        <Toggle checked={a.denoise} onChange={(denoise) => updateDeep(clip.id, 'audio', { denoise })} label="Reduzir ruído" description="Remove zumbido grave, chiado agudo e equilibra a voz (filtros + compressor)." />
        {a.denoise && <Slider label="Intensidade" value={a.denoiseLevel} min={0} max={100} suffix="%" onChange={(v) => updateDeep(clip.id, 'audio', { denoiseLevel: v }, k('dn'))} />}
      </Section>
      {asset?.transcript && (
        <Section title="Voz demo" icon={Mic}>
          <Toggle
            checked={!!a.demoVoice}
            onChange={(demoVoice) => updateDeep(clip.id, 'audio', { demoVoice })}
            label="Ler narração com voz sintética"
            description="Usa a síntese de fala do navegador (pt-BR) para dar voz à transcrição demo durante a reprodução."
          />
        </Section>
      )}
    </>
  );
}
