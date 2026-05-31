from src.worker.gnomad_af import bs1_level, lookup_af, BS1_COMMON, BS1_FREQUENT


def test_bs1_level_thresholds():
    assert bs1_level(0.75) == "common"        # 75%: polimorfismo comune
    assert bs1_level(BS1_COMMON) == "common"  # soglia 5%
    assert bs1_level(0.03) == "frequent"      # 3%: troppo frequente per mendeliana rara
    assert bs1_level(BS1_FREQUENT) == "frequent"
    assert bs1_level(0.005) is None           # 0.5%: nessun segnale BS1
    assert bs1_level(0.0) is None
    assert bs1_level(None) is None


def test_lookup_missing_files_is_graceful():
    # Una posizione su un cromosoma inesistente/non scaricato non deve sollevare.
    assert lookup_af("ZZ", 1, "A", "G") is None
