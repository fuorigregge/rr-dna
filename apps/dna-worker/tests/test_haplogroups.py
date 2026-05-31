from src.worker.haplogroups import parse_haplogrep_output, parse_yhaplo_output


def test_parse_haplogrep_output():
    # Fixture sintetica (aplogruppo mtDNA comune, sample anonimo) — non dati reali.
    text = (
        '"SampleID"\t"Haplogroup"\t"Rank"\t"Quality"\t"Range"\n'
        '"SAMPLE_01"\t"H1c"\t"1"\t"0.9515"\t"1-16569"\n'
    )
    hg, quality = parse_haplogrep_output(text)
    assert hg == "H1c"
    assert abs(quality - 0.9515) < 1e-9


def test_parse_haplogrep_output_empty():
    hg, quality = parse_haplogrep_output('"SampleID"\t"Haplogroup"\t"Rank"\t"Quality"\t"Range"\n')
    assert hg is None and quality is None


def test_parse_yhaplo_output():
    # Fixture sintetica (aplogruppo Y comune, sample anonimo) — non dati reali.
    text = "SAMPLE_01 R-M269         R-M269         R1b1a1b   \n"
    hg, detail = parse_yhaplo_output(text)
    assert hg == "R-M269"
    assert detail == "R1b1a1b"


def test_parse_yhaplo_output_root_or_short():
    # A minimal line with only the short-form haplogroup (no long-form column)
    hg, detail = parse_yhaplo_output("SAMPLE A0-T\n")
    assert hg == "A0-T"
    assert detail is None


def test_parse_yhaplo_output_empty():
    hg, detail = parse_yhaplo_output("")
    assert hg is None and detail is None
