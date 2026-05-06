import React from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Tag, AlertCircle, Users, Scale, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const ProductCard = ({ listing, animal: directAnimal, context = 'general', extraState = {} }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const animal = listing ? listing.animal_details : directAnimal;
  if (!animal) return null;

  const basePrice = listing ? parseFloat(listing.price) : parseFloat(animal.price_egp);
  const finalPrice = listing ? parseFloat(listing.price) : parseFloat(animal.price_after_discount || basePrice);

  const isListingActive = listing ? listing.is_active : true;
  const isAvailable = animal.status === 'available' && isListingActive;
  const discountPercentage = animal.has_discount ? Number(animal.discount_percent || 0) : 0;

  const maxSharesToDisplay = listing ? listing.total_shares : animal.max_shares;
  const displayRemaining = listing ? listing.available_shares : animal.remaining_shares;

  const isShareMode = (context === 'shares' || context === 'adahi_pool' || context === 'adahi_group') && maxSharesToDisplay > 1;

  let displayPrice = finalPrice;
  let priceLabel = t('common.currency');
  let priceForDiscount = parseFloat(animal.price_egp || basePrice);

  if (isShareMode && maxSharesToDisplay > 0) {
    displayPrice = listing?.price_per_share
        ? parseFloat(listing.price_per_share)
        : (finalPrice / maxSharesToDisplay);

    priceForDiscount = basePrice / maxSharesToDisplay;
    priceLabel = `${t('common.currency')} / ${t('common.share')}`;
  }

  const displayName = animal.category_name || animal.name || t('common.product');
  const imageSrc = animal.image || "/default-image.png";
  const animalCode = animal.code?.replace('#', '') || '';
  const currentWeight = Number(animal.current_weight) || 0;

  const isSacrificeValid = animal.is_sacrifice_valid_now || animal.eid_prediction?.is_valid;

  const handleAddToCart = (e) => {
    if (!isAvailable) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const getStatusLabel = () => {
    if (animal.status === 'sold') return t('product.sold');
    if (animal.status === 'reserved') return t('product.reserved');
    return '';
  };

  const getLinkUrl = () => {
    let url = `/animal/${animal.unique_id || animal.id}?context=${extraState.isCreatingGroup ? 'create_adahi_group' : context}`;
    if (extraState.groupCode) {
      url += `&code=${extraState.groupCode}`;
    }
    return url;
  };

  const cardClasses = `
    group flex flex-col bg-white rounded-2xl overflow-hidden
    border border-gray-100 shadow-sm hover:shadow-lg
    hover:-translate-y-1 transition-all duration-300 h-full
    relative ${!isAvailable ? 'opacity-90' : ''}
  `;

  return (
    <Link
      to={getLinkUrl()}
      state={{ listing, context, ...extraState }}
      className={cardClasses}
      aria-label={`${displayName} - ${t('product.view_details')}`}
      onClick={(e) => {
        if (!isAvailable) {
          e.preventDefault();
        }
      }}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        <img
          src={imageSrc}
          alt={displayName}
          className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${!isAvailable ? 'grayscale-[0.5]' : ''}`}
          loading="lazy"
          onError={(e) => {
            e.target.src = "/default-image.png";
            e.target.onerror = null;
          }}
          crossOrigin="anonymous"
        />

        {!isAvailable && (
          <div
            className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]"
            role="status"
            aria-label={getStatusLabel()}
          >
            <span className={`px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg ${animal.status === 'sold' ? 'bg-red-500' : 'bg-orange-500'}`}>
              {getStatusLabel()}
            </span>
          </div>
        )}

        <div className={`absolute top-2 ${isRtl ? 'right-2' : 'left-2'} flex flex-col gap-1.5 z-10`}>
          {isAvailable && animal.has_discount && (
            <span
              className="bg-red-500 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded-lg shadow-sm flex items-center gap-1 animate-pulse"
              aria-label={`${t('common.discount')} ${discountPercentage}%`}
            >
              <Tag size={12} className="fill-current" aria-hidden="true" />
              {t('common.discount')} {discountPercentage}%
            </span>
          )}
          {isAvailable && isSacrificeValid && !animal.has_defect && (
            <span className="bg-amber-500 text-white text-[10px] md:text-xs font-bold px-3 py-1 rounded-lg shadow-md flex items-center gap-1 border border-amber-600 animate-pulse">
              <ShieldCheck size={14} />
              {t('product.special_sacrifice')}
            </span>
          )}
        </div>

        {isShareMode && (
          <div className="absolute bottom-2 right-2 z-10">
            <span
              className="bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg flex items-center gap-1"
              aria-label={`${displayRemaining} ${t('common.share')} ${t('common.out_of')} ${maxSharesToDisplay}`}
            >
              <Users size={10} aria-hidden="true" />
              {displayRemaining} / {maxSharesToDisplay} {t('common.share')}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 md:p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-sm md:text-base font-bold text-dark line-clamp-1 group-hover:text-primary transition-colors">
            {displayName} <span className="text-gray-400 font-normal text-xs">#{animalCode}</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-muted">
          {currentWeight > 0 && (
            <span className="bg-gray-50 px-2 py-1 rounded border border-gray-100 flex items-center gap-1">
              <Scale size={12} aria-hidden="true" />
              <span dir="ltr" className="font-bold text-dark">{currentWeight}</span> {t('common.kg')}
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between">
          <div className="flex flex-col">
            {animal.has_discount && Number(priceForDiscount) > Number(displayPrice) && (
              <span
                className="text-[10px] md:text-xs text-gray-400 line-through decoration-red-400 decoration-1"
                dir="ltr"
                aria-label={`${t('common.original_price')} ${priceForDiscount.toLocaleString()}`}
              >
                {priceForDiscount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )}
            <div className="flex items-baseline gap-1">
              <span
                className="text-base md:text-xl font-black text-primary"
                dir="ltr"
                aria-label={`${t('common.price')} ${displayPrice.toLocaleString()} ${priceLabel}`}
              >
                {displayPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] font-bold text-gray-500">{priceLabel}</span>
            </div>
          </div>

          <button
            className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
              isAvailable ? 'bg-primary text-white hover:bg-primary-dark hover:scale-105 active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!isAvailable}
            title={isAvailable ? t('product.add_to_cart') : getStatusLabel()}
            onClick={handleAddToCart}
            aria-label={isAvailable ? t('product.add_to_cart') : getStatusLabel()}
            aria-disabled={!isAvailable}
          >
            {isAvailable ? (
              <ShoppingCart size={18} aria-hidden="true" />
            ) : (
              <AlertCircle size={18} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
