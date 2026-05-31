"""
Local reference database mapping rsIDs to clinical annotations.
Data curated from ClinVar, PharmGKB, gnomAD, and OMIM public records.

Enum values must match Prisma schema exactly:
  - significance: PATHOGENIC, LIKELY_PATHOGENIC, UNCERTAIN, LIKELY_BENIGN, BENIGN
  - inheritance_pattern: AUTOSOMAL_RECESSIVE, AUTOSOMAL_DOMINANT, X_LINKED
  - category: METABOLISM, PHYSICAL, COGNITIVE

Each entry may include a 'metadata' dict with:
  - description: human-readable explanation
  - links: dict of {label: url} for external resources
  - gene_function: what the gene does
  - rsId: the rsID for convenience
"""

REFERENCE_DB: dict[str, dict] = {
    "rs334": {
        "gene": "HBB",
        "gene_function": "Encodes beta-globin, a subunit of hemoglobin responsible for oxygen transport in red blood cells.",
        "disease_risks": [
            {
                "disease": "Sickle Cell Disease",
                "significance": "PATHOGENIC",
                "source": "ClinVar",
                "evidence_level": "reviewed by expert panel",
                "metadata": {
                    "description": "Mutazione Glu6Val nel gene HBB che causa la formazione di emoglobina S. I globuli rossi assumono forma a falce, causando anemia, crisi dolorose e danno d'organo.",
                    "gene": "HBB",
                    "rsId": "rs334",
                    "prevalence": "1 su 500 nascite nella popolazione afroamericana",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/15126/",
                        "OMIM": "https://omim.org/entry/603903",
                        "MedlinePlus": "https://medlineplus.gov/genetics/condition/sickle-cell-disease/",
                        "GeneReviews": "https://www.ncbi.nlm.nih.gov/books/NBK1377/",
                    },
                },
            },
        ],
        "pharmacogenomics": [],
        "carrier_status": [
            {
                "condition": "Sickle Cell Trait",
                "inheritance_pattern": "AUTOSOMAL_RECESSIVE",
                "carrier_type": "carrier",
                "source": "ClinVar/OMIM",
                "metadata": {
                    "description": "Portatore sano di un allele HBB S. Generalmente asintomatico, ma puo' manifestare sintomi in condizioni di bassa ossigenazione (alta quota, anestesia).",
                    "reproductive_risk": "Se entrambi i genitori sono portatori, 25% di probabilita' per ogni gravidanza di un figlio affetto.",
                    "links": {
                        "OMIM": "https://omim.org/entry/603903",
                        "CDC Sickle Cell": "https://www.cdc.gov/sickle-cell/",
                    },
                },
            },
        ],
        "ancestry_markers": [
            {"haplogroup": None, "population": "African", "frequency": 0.12, "metadata": {
                "description": "L'allele HbS e' frequente nelle popolazioni africane (fino al 12%) a causa del vantaggio selettivo contro la malaria.",
                "links": {"gnomAD": "https://gnomad.broadinstitute.org/variant/11-5227002-T-A?dataset=gnomad_r4"},
            }},
            {"haplogroup": None, "population": "South Asian", "frequency": 0.02, "metadata": {
                "description": "Bassa frequenza nelle popolazioni del sud-est asiatico.",
                "links": {"gnomAD": "https://gnomad.broadinstitute.org/variant/11-5227002-T-A?dataset=gnomad_r4"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs1042522": {
        "gene": "TP53",
        "gene_function": "Tumor suppressor gene ('guardian of the genome'). Regulates cell cycle, DNA repair and apoptosis.",
        "disease_risks": [
            {
                "disease": "Li-Fraumeni Syndrome / Cancer Susceptibility",
                "significance": "LIKELY_PATHOGENIC",
                "source": "ClinVar",
                "evidence_level": "criteria provided",
                "metadata": {
                    "description": "Polimorfismo Pro72Arg nel gene TP53. L'arginina in posizione 72 induce apoptosi piu' efficacemente ma puo' aumentare la suscettibilita' a certi tumori.",
                    "gene": "TP53",
                    "rsId": "rs1042522",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/12351/",
                        "OMIM": "https://omim.org/entry/191170",
                        "PubMed (review)": "https://pubmed.ncbi.nlm.nih.gov/19526045/",
                        "UniProt TP53": "https://www.uniprot.org/uniprot/P04637",
                    },
                },
            },
        ],
        "pharmacogenomics": [],
        "carrier_status": [
            {
                "condition": "TP53 Cancer Predisposition",
                "inheritance_pattern": "AUTOSOMAL_DOMINANT",
                "carrier_type": "at risk",
                "source": "ClinVar/OMIM",
                "metadata": {
                    "description": "Variante nel gene soppressore tumorale TP53. Screening oncologico raccomandato.",
                    "links": {
                        "OMIM": "https://omim.org/entry/191170",
                        "NCCN Guidelines": "https://www.nccn.org/professionals/physician_gls/pdf/genetics_bop.pdf",
                    },
                },
            },
        ],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.72, "metadata": {
                "description": "L'allele Arg72 e' piu' comune nelle popolazioni europee.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs1042522"},
            }},
            {"haplogroup": None, "population": "East Asian", "frequency": 0.45, "metadata": {
                "description": "Frequenza intermedia nelle popolazioni dell'Asia orientale.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs1042522"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs80357713": {
        "gene": "BRCA1",
        "gene_function": "DNA repair gene essential for homologous recombination. Mutations dramatically increase breast and ovarian cancer risk.",
        "disease_risks": [
            {
                "disease": "Hereditary Breast and Ovarian Cancer",
                "significance": "PATHOGENIC",
                "source": "ClinVar",
                "evidence_level": "reviewed by expert panel",
                "metadata": {
                    "description": "Mutazione patogenica nel gene BRCA1. Rischio cumulativo di cancro al seno fino al 72% e cancro ovarico fino al 44% entro i 80 anni.",
                    "gene": "BRCA1",
                    "rsId": "rs80357713",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/17661/",
                        "OMIM": "https://omim.org/entry/113705",
                        "GeneReviews": "https://www.ncbi.nlm.nih.gov/books/NBK1247/",
                        "NCCN Guidelines": "https://www.nccn.org/professionals/physician_gls/pdf/genetics_bop.pdf",
                        "PubMed (NEJM)": "https://pubmed.ncbi.nlm.nih.gov/28493672/",
                    },
                },
            },
        ],
        "pharmacogenomics": [
            {
                "drug": "Olaparib (PARP inhibitor)",
                "effect": "Increased sensitivity to PARP inhibitors",
                "metabolizer_status": None,
                "source": "PharmGKB",
                "evidence_level": "1A",
                "metadata": {
                    "description": "I tumori con mutazione BRCA1 sono sensibili agli inibitori PARP (olaparib, niraparib). Approvato FDA per cancro ovarico e mammario BRCA-mutato.",
                    "links": {
                        "PharmGKB": "https://www.pharmgkb.org/gene/PA18062",
                        "FDA Label Olaparib": "https://www.accessdata.fda.gov/drugsatfda_docs/label/2023/208558s020lbl.pdf",
                        "PubMed (OlympiAD trial)": "https://pubmed.ncbi.nlm.nih.gov/28578601/",
                    },
                },
            },
        ],
        "carrier_status": [
            {
                "condition": "BRCA1 Hereditary Cancer Predisposition",
                "inheritance_pattern": "AUTOSOMAL_DOMINANT",
                "carrier_type": "affected",
                "source": "ClinVar/OMIM",
                "metadata": {
                    "description": "Portatore di mutazione BRCA1. Si raccomanda consulenza genetica e programma di sorveglianza oncologica intensiva.",
                    "reproductive_risk": "50% di probabilita' di trasmettere la mutazione a ogni figlio.",
                    "links": {
                        "OMIM": "https://omim.org/entry/113705",
                        "Genetic Counseling": "https://www.nsgc.org/",
                    },
                },
            },
        ],
        "ancestry_markers": [
            {"haplogroup": None, "population": "Ashkenazi Jewish", "frequency": 0.01, "metadata": {
                "description": "Mutazioni BRCA1 fondatrici sono piu' comuni nella popolazione ebraica ashkenazita (~1%).",
                "links": {"PubMed": "https://pubmed.ncbi.nlm.nih.gov/8533748/"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs1800497": {
        "gene": "DRD2/ANKK1",
        "gene_function": "Regulates dopamine D2 receptor density in the brain. Influences reward pathways and addiction susceptibility.",
        "disease_risks": [
            {
                "disease": "Addiction Susceptibility",
                "significance": "UNCERTAIN",
                "source": "ClinVar",
                "evidence_level": "criteria provided",
                "metadata": {
                    "description": "Polimorfismo Taq1A (rs1800497) associato a ridotta densita' dei recettori D2 della dopamina. Studi mostrano associazione con alcolismo e comportamenti di dipendenza.",
                    "gene": "DRD2/ANKK1",
                    "rsId": "rs1800497",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/17859/",
                        "dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs1800497",
                        "PubMed (meta-analysis)": "https://pubmed.ncbi.nlm.nih.gov/21172165/",
                    },
                },
            },
        ],
        "pharmacogenomics": [
            {
                "drug": "Dopamine Agonists",
                "effect": "Reduced dopamine receptor density",
                "metabolizer_status": "intermediate",
                "source": "PharmGKB",
                "evidence_level": "2A",
                "metadata": {
                    "description": "Ridotta densita' di recettori D2 puo' influenzare la risposta a farmaci dopaminergici. Monitoraggio clinico raccomandato.",
                    "links": {
                        "PharmGKB": "https://www.pharmgkb.org/variant/PA166155094",
                    },
                },
            },
        ],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.20, "metadata": {
                "description": "Frequenza ~20% nelle popolazioni europee.",
                "links": {"gnomAD": "https://gnomad.broadinstitute.org/variant/11-113400106-G-A?dataset=gnomad_r4"},
            }},
            {"haplogroup": None, "population": "East Asian", "frequency": 0.35, "metadata": {
                "description": "Frequenza piu' elevata (~35%) nelle popolazioni dell'Asia orientale.",
                "links": {"gnomAD": "https://gnomad.broadinstitute.org/variant/11-113400106-G-A?dataset=gnomad_r4"},
            }},
        ],
        "phenotype_traits": [
            {
                "trait": "Dopamine Receptor Sensitivity",
                "effect": "Reduced D2 receptor density (Taq1A polymorphism)",
                "category": "COGNITIVE",
                "source": "PharmGKB",
                "metadata": {
                    "description": "Il polimorfismo Taq1A riduce la densita' dei recettori D2 nel cervello, influenzando motivazione, ricompensa e apprendimento.",
                    "links": {
                        "PubMed": "https://pubmed.ncbi.nlm.nih.gov/21172165/",
                        "SNPedia": "https://www.snpedia.com/index.php/Rs1800497",
                    },
                },
            },
        ],
    },
    "rs121913529": {
        "gene": "EGFR",
        "gene_function": "Epidermal Growth Factor Receptor. Tyrosine kinase driving cell growth. Key target in lung cancer therapy.",
        "disease_risks": [
            {
                "disease": "Non-Small Cell Lung Cancer Susceptibility",
                "significance": "PATHOGENIC",
                "source": "ClinVar",
                "evidence_level": "reviewed by expert panel",
                "metadata": {
                    "description": "Mutazione attivante nel gene EGFR (L858R o delezione esone 19). Presente nel 10-15% dei NSCLC nei pazienti europei e fino al 50% nei pazienti asiatici.",
                    "gene": "EGFR",
                    "rsId": "rs121913529",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/16609/",
                        "OMIM": "https://omim.org/entry/131550",
                        "My Cancer Genome": "https://www.mycancergenome.org/content/alteration/egfr-l858r/",
                        "PubMed (NEJM)": "https://pubmed.ncbi.nlm.nih.gov/15118073/",
                    },
                },
            },
        ],
        "pharmacogenomics": [
            {
                "drug": "Erlotinib",
                "effect": "Increased sensitivity to EGFR inhibitors",
                "metabolizer_status": None,
                "source": "PharmGKB",
                "evidence_level": "1A",
                "metadata": {
                    "description": "Erlotinib (Tarceva) e' un inibitore tirosin-chinasico di EGFR. Pazienti con mutazione EGFR mostrano tassi di risposta del 60-80%.",
                    "links": {
                        "PharmGKB": "https://www.pharmgkb.org/gene/PA154",
                        "FDA Label": "https://www.accessdata.fda.gov/drugsatfda_docs/label/2016/021743s025lbl.pdf",
                    },
                },
            },
            {
                "drug": "Gefitinib",
                "effect": "Increased sensitivity to EGFR inhibitors",
                "metabolizer_status": None,
                "source": "PharmGKB",
                "evidence_level": "1A",
                "metadata": {
                    "description": "Gefitinib (Iressa) e' un inibitore selettivo di EGFR. Prima linea nel NSCLC con mutazione EGFR.",
                    "links": {
                        "PharmGKB": "https://www.pharmgkb.org/gene/PA154",
                        "PubMed (IPASS trial)": "https://pubmed.ncbi.nlm.nih.gov/19692680/",
                    },
                },
            },
        ],
        "carrier_status": [],
        "ancestry_markers": [],
        "phenotype_traits": [],
    },
    "rs1050828": {
        "gene": "G6PD",
        "gene_function": "Glucose-6-phosphate dehydrogenase. Essential for red blood cell protection against oxidative stress.",
        "disease_risks": [
            {
                "disease": "G6PD Deficiency",
                "significance": "PATHOGENIC",
                "source": "ClinVar",
                "evidence_level": "reviewed by expert panel",
                "metadata": {
                    "description": "Deficit di G6PD, l'enzimopatia piu' comune al mondo (~400 milioni di persone). Causa anemia emolitica acuta dopo esposizione a farmaci ossidanti, fave o infezioni.",
                    "gene": "G6PD",
                    "rsId": "rs1050828",
                    "prevalence": "Fino al 20% nei maschi africani, 8% nel Mediterraneo",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/9555/",
                        "OMIM": "https://omim.org/entry/305900",
                        "MedlinePlus": "https://medlineplus.gov/g6pddeficiency.html",
                        "GeneReviews": "https://www.ncbi.nlm.nih.gov/books/NBK22005/",
                    },
                },
            },
        ],
        "pharmacogenomics": [
            {
                "drug": "Primaquine",
                "effect": "Contraindicated - hemolytic anemia risk",
                "metabolizer_status": None,
                "source": "PharmGKB",
                "evidence_level": "1A",
                "metadata": {
                    "description": "CONTROINDICATO nei pazienti con deficit di G6PD. Causa crisi emolitica grave. Farmaco antimalarico da evitare assolutamente.",
                    "links": {
                        "PharmGKB": "https://www.pharmgkb.org/gene/PA28469",
                        "CPIC Guideline": "https://cpicpgx.org/guidelines/cpic-guideline-for-rasburicase-and-g6pd/",
                    },
                },
            },
            {
                "drug": "Rasburicase",
                "effect": "Contraindicated - hemolytic anemia risk",
                "metabolizer_status": None,
                "source": "PharmGKB",
                "evidence_level": "1A",
                "metadata": {
                    "description": "CONTROINDICATO. Rasburicase genera perossido di idrogeno che non puo' essere neutralizzato in assenza di G6PD.",
                    "links": {
                        "PharmGKB": "https://www.pharmgkb.org/gene/PA28469",
                        "FDA Safety Alert": "https://www.fda.gov/drugs/drug-safety-and-availability/",
                    },
                },
            },
        ],
        "carrier_status": [
            {
                "condition": "G6PD Deficiency",
                "inheritance_pattern": "X_LINKED",
                "carrier_type": "carrier",
                "source": "ClinVar/OMIM",
                "metadata": {
                    "description": "Ereditarieta' X-linked: maschi emizigoti sono affetti, femmine eterozigoti sono portatrici (possono avere sintomi lievi per lionizzazione sfavorevole).",
                    "reproductive_risk": "Madre portatrice: 50% dei figli maschi affetti, 50% delle figlie portatrici.",
                    "links": {
                        "OMIM": "https://omim.org/entry/305900",
                        "Genetics Home Reference": "https://medlineplus.gov/genetics/condition/glucose-6-phosphate-dehydrogenase-deficiency/",
                    },
                },
            },
        ],
        "ancestry_markers": [
            {"haplogroup": None, "population": "African", "frequency": 0.20, "metadata": {
                "description": "Alta frequenza in Africa per vantaggio selettivo contro la malaria (come HbS).",
                "links": {"gnomAD": "https://gnomad.broadinstitute.org/variant/X-154535277-C-T?dataset=gnomad_r4"},
            }},
            {"haplogroup": None, "population": "Mediterranean", "frequency": 0.08, "metadata": {
                "description": "Frequente nel bacino del Mediterraneo (Sardegna, Grecia, Medio Oriente).",
                "links": {"gnomAD": "https://gnomad.broadinstitute.org/variant/X-154535277-C-T?dataset=gnomad_r4"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs1799983": {
        "gene": "NOS3",
        "gene_function": "Endothelial nitric oxide synthase. Produces NO for vasodilation and cardiovascular protection.",
        "disease_risks": [
            {
                "disease": "Cardiovascular Disease Risk",
                "significance": "LIKELY_PATHOGENIC",
                "source": "ClinVar",
                "evidence_level": "criteria provided",
                "metadata": {
                    "description": "Polimorfismo Glu298Asp (rs1799983) nel gene NOS3. Riduce la produzione di ossido nitrico endoteliale, aumentando il rischio di ipertensione, coronaropatia e ictus.",
                    "gene": "NOS3",
                    "rsId": "rs1799983",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/17858/",
                        "dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs1799983",
                        "PubMed (meta-analysis)": "https://pubmed.ncbi.nlm.nih.gov/15166209/",
                    },
                },
            },
        ],
        "pharmacogenomics": [],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.35, "metadata": {
                "description": "Frequenza ~35% in Europa.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs1799983"},
            }},
            {"haplogroup": None, "population": "East Asian", "frequency": 0.10, "metadata": {
                "description": "Meno frequente nelle popolazioni asiatiche (~10%).",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs1799983"},
            }},
        ],
        "phenotype_traits": [
            {
                "trait": "Endothelial Nitric Oxide Production",
                "effect": "Reduced NO production; increased cardiovascular risk",
                "category": "PHYSICAL",
                "source": "ClinVar",
                "metadata": {
                    "description": "Ridotta produzione di ossido nitrico endoteliale. L'NO e' un vasodilatatore critico per la salute cardiovascolare.",
                    "links": {
                        "PubMed": "https://pubmed.ncbi.nlm.nih.gov/15166209/",
                        "SNPedia": "https://www.snpedia.com/index.php/Rs1799983",
                    },
                },
            },
            {
                "trait": "Exercise Blood Pressure Response",
                "effect": "Higher blood pressure response during exercise",
                "category": "PHYSICAL",
                "source": "ClinVar",
                "metadata": {
                    "description": "Durante l'esercizio fisico, la ridotta produzione di NO puo' causare un aumento maggiore della pressione arteriosa.",
                    "links": {"PubMed": "https://pubmed.ncbi.nlm.nih.gov/19451835/"},
                },
            },
        ],
    },
    "rs2228001": {
        "gene": "XPC",
        "gene_function": "DNA repair gene in the nucleotide excision repair (NER) pathway. Protects against UV-induced DNA damage.",
        "disease_risks": [
            {
                "disease": "Xeroderma Pigmentosum / Skin Cancer Susceptibility",
                "significance": "UNCERTAIN",
                "source": "ClinVar",
                "evidence_level": "criteria provided",
                "metadata": {
                    "description": "Polimorfismo Lys939Gln nel gene XPC coinvolto nella riparazione del DNA. Associato a lieve aumento del rischio di tumori cutanei in meta-analisi.",
                    "gene": "XPC",
                    "rsId": "rs2228001",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/5184/",
                        "dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs2228001",
                        "PubMed (meta-analysis)": "https://pubmed.ncbi.nlm.nih.gov/23266568/",
                    },
                },
            },
        ],
        "pharmacogenomics": [],
        "carrier_status": [
            {
                "condition": "Xeroderma Pigmentosum",
                "inheritance_pattern": "AUTOSOMAL_RECESSIVE",
                "carrier_type": "carrier",
                "source": "ClinVar/OMIM",
                "metadata": {
                    "description": "Lo Xeroderma Pigmentosum e' una malattia rara (1:250.000) con estrema sensibilita' ai raggi UV. Portatori eterozigoti sono generalmente asintomatici.",
                    "links": {
                        "OMIM": "https://omim.org/entry/278720",
                        "GeneReviews": "https://www.ncbi.nlm.nih.gov/books/NBK1397/",
                    },
                },
            },
        ],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.37, "metadata": {
                "description": "Frequenza ~37% nelle popolazioni europee.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs2228001"},
            }},
            {"haplogroup": None, "population": "African", "frequency": 0.28, "metadata": {
                "description": "Frequenza ~28% nelle popolazioni africane.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs2228001"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs113488022": {
        "gene": "BRAF",
        "gene_function": "Serine/threonine protein kinase in the RAS-MAPK signaling pathway. Key oncogene in melanoma.",
        "disease_risks": [
            {
                "disease": "Melanoma Susceptibility",
                "significance": "LIKELY_PATHOGENIC",
                "source": "ClinVar",
                "evidence_level": "criteria provided",
                "metadata": {
                    "description": "Mutazione V600E nel gene BRAF, presente in ~50% dei melanomi. Attiva costitutivamente la via MAPK promuovendo la proliferazione cellulare.",
                    "gene": "BRAF",
                    "rsId": "rs113488022",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/13961/",
                        "OMIM": "https://omim.org/entry/164757",
                        "My Cancer Genome": "https://www.mycancergenome.org/content/alteration/braf-v600e/",
                        "PubMed (Nature 2002)": "https://pubmed.ncbi.nlm.nih.gov/12068308/",
                    },
                },
            },
        ],
        "pharmacogenomics": [
            {
                "drug": "Vemurafenib",
                "effect": "BRAF V600E targeted therapy candidate",
                "metabolizer_status": None,
                "source": "PharmGKB",
                "evidence_level": "1A",
                "metadata": {
                    "description": "Vemurafenib (Zelboraf) e' un inibitore selettivo di BRAF V600E. Tasso di risposta ~50% nel melanoma metastatico BRAF-mutato.",
                    "links": {
                        "PharmGKB": "https://www.pharmgkb.org/gene/PA25394",
                        "FDA Label": "https://www.accessdata.fda.gov/drugsatfda_docs/label/2017/202429s012lbl.pdf",
                        "PubMed (BRIM-3 trial)": "https://pubmed.ncbi.nlm.nih.gov/21639808/",
                    },
                },
            },
        ],
        "carrier_status": [],
        "ancestry_markers": [],
        "phenotype_traits": [],
    },
    "rs1800234": {
        "gene": "NAT1",
        "gene_function": "N-acetyltransferase 1. Phase II drug metabolism enzyme involved in acetylation of aromatic amines.",
        "disease_risks": [],
        "pharmacogenomics": [
            {
                "drug": "Isoniazid",
                "effect": "Altered acetylation metabolism",
                "metabolizer_status": "slow",
                "source": "PharmGKB",
                "evidence_level": "2A",
                "metadata": {
                    "description": "Acetilatori lenti hanno livelli piu' alti di isoniazide nel sangue, aumentando il rischio di epatotossicita' e neuropatia periferica. Riduzione della dose raccomandata.",
                    "links": {
                        "PharmGKB": "https://www.pharmgkb.org/gene/PA18",
                        "CPIC Guideline": "https://cpicpgx.org/guidelines/cpic-guideline-for-isoniazid-and-nat2/",
                    },
                },
            },
            {
                "drug": "Sulfonamides",
                "effect": "Altered acetylation metabolism",
                "metabolizer_status": "slow",
                "source": "PharmGKB",
                "evidence_level": "2A",
                "metadata": {
                    "description": "Metabolismo rallentato dei sulfonamidi negli acetilatori lenti. Maggior rischio di reazioni avverse cutanee.",
                    "links": {"PharmGKB": "https://www.pharmgkb.org/gene/PA18"},
                },
            },
        ],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.25, "metadata": {
                "description": "~25% degli europei sono acetilatori lenti per NAT1.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs1800234"},
            }},
        ],
        "phenotype_traits": [
            {
                "trait": "Acetylator Phenotype",
                "effect": "Slow acetylator status",
                "category": "METABOLISM",
                "source": "PharmGKB",
                "metadata": {
                    "description": "Fenotipo acetilatore lento: metabolismo ridotto di farmaci e sostanze aromatiche. Influenza la risposta a isoniazide, sulfamidici e caffeina.",
                    "links": {
                        "PharmGKB": "https://www.pharmgkb.org/gene/PA18",
                        "PubMed": "https://pubmed.ncbi.nlm.nih.gov/22006186/",
                    },
                },
            },
        ],
    },
    "rs75062661": {
        "gene": "OR4F5",
        "gene_function": "Olfactory receptor gene. Part of the largest gene family in the human genome.",
        "disease_risks": [],
        "pharmacogenomics": [],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.15, "metadata": {
                "description": "Variante in un gene del recettore olfattivo. Marcatore di ancestralita' con distribuzione variabile tra popolazioni.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs75062661"},
            }},
            {"haplogroup": None, "population": "African", "frequency": 0.22, "metadata": {
                "description": "Piu' frequente nelle popolazioni africane.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs75062661"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs3094315": {
        "gene": "intergenic",
        "gene_function": "Intergenic variant. Used as ancestry informative marker (AIM) in population genetics studies.",
        "disease_risks": [],
        "pharmacogenomics": [],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.83, "metadata": {
                "description": "Marcatore altamente informativo per ancestralita' europea (83%). Uno dei 128 AIM utilizzati nei panel di genotipizzazione.",
                "links": {
                    "dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs3094315",
                    "PubMed (AIM panel)": "https://pubmed.ncbi.nlm.nih.gov/15088268/",
                },
            }},
            {"haplogroup": None, "population": "East Asian", "frequency": 0.15, "metadata": {
                "description": "Bassa frequenza in Asia orientale, conferma la differenziazione tra popolazioni.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs3094315"},
            }},
            {"haplogroup": None, "population": "African", "frequency": 0.40, "metadata": {
                "description": "Frequenza intermedia nelle popolazioni africane.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs3094315"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs61768173": {
        "gene": "intergenic",
        "gene_function": "Intergenic variant with no known functional impact.",
        "disease_risks": [],
        "pharmacogenomics": [],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.05, "metadata": {
                "description": "Variante rara, frequenza ~5% in Europa.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs61768173"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs149886465": {
        "gene": "intergenic",
        "gene_function": "Intergenic variant with no known functional impact.",
        "disease_risks": [],
        "pharmacogenomics": [],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.01, "metadata": {
                "description": "Variante molto rara (~1%). Utile per analisi di fine-mapping.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs149886465"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs4665987": {
        "gene": "intergenic",
        "gene_function": "Intergenic variant used as ancestry informative marker.",
        "disease_risks": [],
        "pharmacogenomics": [],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.45, "metadata": {
                "description": "Marcatore di ancestralita' con distribuzione differenziale tra popolazioni.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs4665987"},
            }},
            {"haplogroup": None, "population": "African", "frequency": 0.30, "metadata": {
                "description": "Frequenza ~30% nelle popolazioni africane.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs4665987"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs6546473": {
        "gene": "intergenic",
        "gene_function": "Intergenic variant used as ancestry informative marker.",
        "disease_risks": [],
        "pharmacogenomics": [],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.60, "metadata": {
                "description": "Frequenza 60% in Europa, utile per stima di ancestralita'.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs6546473"},
            }},
            {"haplogroup": None, "population": "South Asian", "frequency": 0.25, "metadata": {
                "description": "Frequenza ~25% nel subcontinente indiano.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs6546473"},
            }},
        ],
        "phenotype_traits": [],
    },
    "rs2230339": {
        "gene": "COL1A2",
        "gene_function": "Encodes alpha-2 chain of type I collagen, the major structural protein of bone, skin and tendons.",
        "disease_risks": [
            {
                "disease": "Ehlers-Danlos Syndrome",
                "significance": "LIKELY_BENIGN",
                "source": "ClinVar",
                "evidence_level": "criteria provided",
                "metadata": {
                    "description": "Variante nel gene del collagene di tipo I. Classificata come probabilmente benigna. La sindrome di Ehlers-Danlos causa ipermobilita' articolare e fragilita' cutanea.",
                    "gene": "COL1A2",
                    "rsId": "rs2230339",
                    "links": {
                        "ClinVar": "https://www.ncbi.nlm.nih.gov/clinvar/variation/36476/",
                        "OMIM": "https://omim.org/entry/130600",
                        "dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs2230339",
                    },
                },
            },
        ],
        "pharmacogenomics": [],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.50, "metadata": {
                "description": "Frequenza ~50% nelle popolazioni europee.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs2230339"},
            }},
        ],
        "phenotype_traits": [
            {
                "trait": "Collagen Structure",
                "effect": "Normal collagen production variant",
                "category": "PHYSICAL",
                "source": "ClinVar",
                "metadata": {
                    "description": "Variante sinonima nel gene del collagene. Non altera la struttura proteica. Il collagene di tipo I e' il piu' abbondante nell'organismo.",
                    "links": {
                        "UniProt COL1A2": "https://www.uniprot.org/uniprot/P08123",
                    },
                },
            },
        ],
    },
    "rs6527561": {
        "gene": "DMD region",
        "gene_function": "Near the dystrophin gene. Dystrophin is essential for muscle cell membrane integrity.",
        "disease_risks": [],
        "pharmacogenomics": [],
        "carrier_status": [],
        "ancestry_markers": [
            {"haplogroup": None, "population": "European", "frequency": 0.55, "metadata": {
                "description": "Frequenza ~55% in Europa. Variante intronice nella regione del gene DMD.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs6527561"},
            }},
            {"haplogroup": None, "population": "African", "frequency": 0.70, "metadata": {
                "description": "Frequenza ~70% nelle popolazioni africane.",
                "links": {"dbSNP": "https://www.ncbi.nlm.nih.gov/snp/rs6527561"},
            }},
        ],
        "phenotype_traits": [
            {
                "trait": "Muscle Fiber Composition",
                "effect": "Associated with muscle fiber type distribution",
                "category": "PHYSICAL",
                "source": "GWAS Catalog",
                "metadata": {
                    "description": "Associata alla distribuzione delle fibre muscolari (tipo I lente vs tipo II veloci). Puo' influenzare la predisposizione a sport di resistenza vs potenza.",
                    "links": {
                        "GWAS Catalog": "https://www.ebi.ac.uk/gwas/",
                        "PubMed": "https://pubmed.ncbi.nlm.nih.gov/25559067/",
                    },
                },
            },
        ],
    },
}
