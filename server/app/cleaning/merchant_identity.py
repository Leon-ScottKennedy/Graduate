"""Separate platform evidence from unverified shop-name claims."""
import re


def merchant_identity(platform, shop, raw):
    basic = raw.get('item_basic_info') or {}
    self_operated = platform == 'jd' and raw.get('owner') == 'g'
    tmall = platform == 'taobao' and str(basic.get('user_type')) == '1'
    claim = bool(re.search(r'官方|旗舰店', shop or ''))
    labels = ['京东自营' if self_operated else '京东店' if platform == 'jd' else '天猫店' if tmall else '淘宝店']
    # No authoritative seller-ID ownership verification has been established yet.
    if claim and not self_operated:
        labels.append('店名含官方/旗舰标识 · 待核验')
    return dict(storeLabels=labels, isTmall=tmall, isJdSelfOperated=self_operated,
                merchantEligible=self_operated or tmall or (platform == 'jd' and bool(shop)),
                officialBrandStoreVerified=False,
                officialStoreStatus='未核验', shopNameClaimsOfficial=claim)
