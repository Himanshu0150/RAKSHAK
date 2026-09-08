import io
from datetime import datetime
from typing import List, Dict, Any, Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY

def generate_case_evidence_export_pdf(
    case_id: str,
    case_title: Optional[str],
    evidence_list: List[Dict[str, Any]],
    officer_name: str = "Lead Investigator"
) -> bytes:
    """
    Generates an Informational Case Evidence Export Report PDF for a specific case
    using ReportLab. Exposes only evidence belonging to the authorized case.
    Does NOT claim legal admissibility (informational investigative export).
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom Palette
    PRIMARY = colors.HexColor('#1E293B')      # Slate 800
    ACCENT = colors.HexColor('#1D4ED8')       # Blue 700
    LIGHT_BG = colors.HexColor('#F8FAFC')     # Slate 50
    BORDER_COLOR = colors.HexColor('#CBD5E1') # Slate 300
    TEXT_DARK = colors.HexColor('#0F172A')
    MUTED_TEXT = colors.HexColor('#64748B')

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        alignment=TA_CENTER,
        textColor=PRIMARY
    )

    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        alignment=TA_CENTER,
        textColor=ACCENT
    )

    h2_style = ParagraphStyle(
        'H2Section',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        alignment=TA_LEFT,
        textColor=PRIMARY,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        alignment=TA_LEFT,
        textColor=TEXT_DARK
    )

    disclaimer_style = ParagraphStyle(
        'DisclaimerText',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=11,
        alignment=TA_JUSTIFY,
        textColor=MUTED_TEXT
    )

    mono_style = ParagraphStyle(
        'MonoCustom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8,
        leading=10,
        alignment=TA_LEFT,
        textColor=PRIMARY
    )

    story = []

    # Title & Subtitle Header
    story.append(Paragraph("RAKSHAK NATIONAL CRIME INTELLIGENCE PLATFORM", subtitle_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph("CASE EVIDENCE EXPORT REPORT", title_style))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Authorized Investigative Scope: {case_title or case_id} ({case_id})", subtitle_style))
    story.append(Spacer(1, 10))

    # Top Metadata Table
    export_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    meta_data = [
        [
            Paragraph("<b>Case ID:</b>", body_style),
            Paragraph(str(case_id), mono_style),
            Paragraph("<b>Total Records:</b>", body_style),
            Paragraph(f"{len(evidence_list)} Items", body_style)
        ],
        [
            Paragraph("<b>Export Timestamp:</b>", body_style),
            Paragraph(export_time, body_style),
            Paragraph("<b>Exported By:</b>", body_style),
            Paragraph(officer_name, body_style)
        ]
    ]

    meta_table = Table(meta_data, colWidths=[110, 160, 110, 160])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_BG),
        ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # Informational Disclaimer Banner
    disclaimer_text = (
        "<b>NOTICE & INFORMATIONAL DISCLAIMER:</b> This document contains a comprehensive record of evidence items "
        f"indexed under Case <b>{case_id}</b> within the RAKSHAK database. This report is generated strictly for "
        "internal law enforcement and investigative review. It does NOT constitute a Section 63 BSA Legal Admissibility "
        "Certificate. For court-admissible electronic evidence certification, generate an individual Section 63 BSA Certificate."
    )
    disc_table = Table([[Paragraph(disclaimer_text, disclaimer_style)]], colWidths=[540])
    disc_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#FEF3C7')), # Yellow 100
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#F59E0B')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(disc_table)
    story.append(Spacer(1, 14))

    # Section 2: Detailed Evidence Items
    story.append(Paragraph("CASE EVIDENCE REPOSITORY LISTING", h2_style))
    story.append(HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceBefore=2, spaceAfter=8))

    if not evidence_list:
        story.append(Paragraph("No evidence records currently indexed for this case.", body_style))
    else:
        for idx, ev in enumerate(evidence_list, start=1):
            ev_id = str(ev.get("evidence_id") or ev.get("id") or f"EVID-{idx:04d}")
            ev_type = str(ev.get("evidence_type") or ev.get("evidenceType") or "SURVEILLANCE").upper()
            desc = str(ev.get("description") or ev.get("title") or "N/A")
            sha256 = str(ev.get("integrity_sha256") or ev.get("sha256Hash") or ev.get("hash") or "N/A")
            collected = str(ev.get("collected_at") or ev.get("collectionTimestamp") or "N/A")
            source = str(ev.get("source") or ev.get("sourceDeviceOrMedium") or "Law Enforcement Intercept")

            item_data = [
                [
                    Paragraph(f"<b>Item #{idx}:</b> {ev_id}", h2_style),
                    Paragraph(f"<b>Type:</b> {ev_type}", body_style)
                ],
                [
                    Paragraph("<b>Description:</b>", body_style),
                    Paragraph(desc, body_style)
                ],
                [
                    Paragraph("<b>Collection Source:</b>", body_style),
                    Paragraph(source, body_style)
                ],
                [
                    Paragraph("<b>Timestamp:</b>", body_style),
                    Paragraph(collected, body_style)
                ],
                [
                    Paragraph("<b>SHA-256 Hash:</b>", body_style),
                    Paragraph(sha256, mono_style)
                ]
            ]

            item_table = Table(item_data, colWidths=[130, 410])
            item_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F1F5F9')),
                ('BOX', (0,0), (-1,-1), 0.75, BORDER_COLOR),
                ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
                ('PADDING', (0,0), (-1,-1), 4.5),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ]))

            story.append(KeepTogether([item_table, Spacer(1, 8)]))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
