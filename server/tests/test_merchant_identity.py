import unittest
from app.cleaning.merchant_identity import merchant_identity


class MerchantIdentityTests(unittest.TestCase):
    def test_tmall_flagship_name_is_not_ownership_verification(self):
        result = merchant_identity('taobao', '华硕官方旗舰店', {'item_basic_info': {'user_type': 1}})
        self.assertTrue(result['isTmall'])
        self.assertTrue(result['shopNameClaimsOfficial'])
        self.assertFalse(result['officialBrandStoreVerified'])
        self.assertIn('天猫店', result['storeLabels'])
        self.assertTrue(result['merchantEligible'])

    def test_name_does_not_establish_platform_identity(self):
        result = merchant_identity('taobao', '天猫官方旗舰店', {})
        self.assertFalse(result['isTmall'])
        self.assertFalse(result['merchantEligible'])
        self.assertFalse(result['officialBrandStoreVerified'])

    def test_jd_self_operation_requires_owner_metadata(self):
        self.assertFalse(merchant_identity('jd', '京东自营旗舰店', {'owner': 'p'})['isJdSelfOperated'])
        result = merchant_identity('jd', '普通店名', {'owner': 'g'})
        self.assertTrue(result['isJdSelfOperated'])
        self.assertFalse(result['officialBrandStoreVerified'])
