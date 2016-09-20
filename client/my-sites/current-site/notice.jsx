/**
 * External dependencies
 */
import React, { PropTypes } from 'react';
import url from 'url';
import config from 'config';
import { connect } from 'react-redux';
import classNames from 'classnames';
import debugFactory from 'debug';

/**
 * Internal dependencies
 */
import Notice from 'components/notice';
import NoticeAction from 'components/notice/notice-action';
import { userCan } from 'lib/site/utils';
import QuerySiteUpdates from 'components/data/query-site-updates';
import paths from 'my-sites/upgrades/paths';
import { hasDomainCredit } from 'state/sites/plans/selectors';

import { isJetpackSite } from 'state/sites/selectors';
import {
	getUpdatesBySiteId,
	hasWordPressUpdate,
	hasUpdates as siteHasUpdate,
	getSectionsToUpdate,
} from 'state/sites/updates/selectors';

import { canCurrentUser } from 'state/current-user/selectors';
import { recordTracksEvent } from 'state/analytics/actions';
import QuerySitePlans from 'components/data/query-site-plans';
import { isFinished as isJetpackPluginsFinished } from 'state/plugins/premium/selectors';
import TrackComponentView from 'lib/analytics/track-component-view';
import Popover from 'components/popover';

const debug = debugFactory( 'calypso:current-site:notice' );

const SiteNotice = React.createClass( {
	propTypes: {
		site: PropTypes.object,
		isJetpack: PropTypes.bool,
		hasWPUpdate: PropTypes.bool,
		hasUpdates: PropTypes.bool,
		updates: PropTypes.object
	},

	getDefaultProps() {
		return {
		};
	},

	getInitialState() {
		return {
			showJetpackPopover: false
		};
	},

	getSiteRedirectNotice: function( site ) {
		if ( ! site ) {
			return null;
		}
		if ( ! ( site.options && site.options.is_redirect ) ) {
			return null;
		}
		const { hostname } = url.parse( site.URL );

		return (
			<Notice
				showDismiss={ false }
				icon="info-outline"
				isCompact
			>
				{ this.translate( 'Redirects to {{a}}%(url)s{{/a}}', {
					args: { url: hostname },
					components: { a: <a href={ site.URL } /> }
				} ) }
				<NoticeAction href={ paths.domainManagementList( site.domain ) }>
					{ this.translate( 'Edit' ) }
				</NoticeAction>
			</Notice>
		);
	},

	domainCreditNotice() {
		if ( ! this.props.hasDomainCredit || ! this.props.canManageOptions ) {
			return null;
		}

		const eventName = 'calypso_domain_credit_reminder_impression';
		const eventProperties = { cta_name: 'current_site_domain_notice' };
		return (
			<Notice isCompact status="is-success" icon="info-outline">
				{ this.translate( 'Free domain available' ) }
				<NoticeAction
					onClick={ this.props.clickClaimDomainNotice }
					href={ `/domains/add/${ this.props.site.slug }` }
				>
					{ this.translate( 'Claim' ) }
					<TrackComponentView eventName={ eventName } eventProperties={ eventProperties } />
				</NoticeAction>
			</Notice>
		);
	},

	jetpackPluginsSetupNotice() {
		if ( ! this.props.pausedJetpackPluginsSetup || this.props.site.plan.product_slug === 'jetpack_free' ) {
			return null;
		}

		return (
			<Notice isCompact status="is-info" icon="plugins">
				{ this.translate(
					'Your %(plan)s plan needs setting up!',
					{ args: { plan: this.props.site.plan.product_name_short } }
				) }
				<NoticeAction href={ `/plugins/setup/${ this.props.site.slug }` } >
					{ this.translate( 'Finish' ) }
				</NoticeAction>
			</Notice>
		);
	},

	toggleJetpackNotificatonsPopover() {
		this.setState( { showJetpackPopover: ! this.state.showJetpackPopover } );
	},

	hideJetpackNotificatonsPopover() {
		this.setState( { showJetpackPopover: false } );
	},

	renderWPComUpdate() {
		const { updates } = this.props;

		if ( ! (
			config.isEnabled( 'jetpack_core_inline_update' ) ||
			updates.wordpress ||
			updates.wp_update_version
		) ) {
			return null;
		}

		return (
			<div className="current-site__jetpack-notifications-block">
				{
					this.translate( 'A newer version of WordPress is available. {{link}}Update to %(version)s{{/link}}.', {
						components: {
							link: <a className="button is-link" onClick={ this.handleUpdate } />
						},
						args: {
							version: updates.wp_update_version
						}
					} )
				}
			</div>
		);
	},

	renderPluginsUpdate() {
		const { updates } = this.props;

		if ( ! this.props.site.canUpdateFiles || ! updates.plugins ) {
			return null;
		}

		return (
			<div className="current-site__jetpack-notifications-block">
				{
					this.translate(
						'There is %(total)d plugin {{link}}update available{{/link}}.',
						'There are %(total)d plugin {{link}}updates available{{/link}}.',
						{
							components: {
								link: <a
									onClick={ this.hideJetpackNotificatonsPopover }
									href={ '/plugins/updates/' + this.props.site.slug } />
							},
							count: updates.plugins,
							args: {
								total: updates.plugins
							}
						}
					)
				}
			</div>
		);
	},

	renderThemesUpdate() {
		const { updates, site } = this.props;

		if ( ! updates.themes ) {
			return null;
		}

		return (
			<div className="current-site__jetpack-notifications-block">
				{
					this.translate(
						'There is %(total)d theme {{link}}update available{{/link}}.',
						'There are %(total)d theme {{link}}updates available{{/link}}.',
						{
							components: {
								link: <a
									onClick={ this.hideJetpackNotificatonsPopover }
									target="_blanck"
									href={ site.options.admin_url + 'update-core.php#update-themes-table' } />
							},
							count: updates.themes,
							args: {
								total: updates.themes
							}
						}
					)
				}
			</div>
		);
	},

	renderJetpackNotifications() {
		const { site, isJetpack, hasUpdates, sectionsToUpdate } = this.props;
		const { showJetpackPopover } = this.state;

		if ( ! isJetpack ) {
			return debug( 'No Jetpack site' );
		}

		if ( ! userCan( 'manage_options', site ) ) {
			return debug( 'User can\'t manage options' );
		}

		if ( ! hasUpdates ) {
			return debug( '%s doesn\'t have updates', site.ID );
		}

		let title;

		if ( sectionsToUpdate.length > 1 ) {
			title = this.translate(
				'There is an update available.',
				'There are updates available.',
				{ count: site.updates.total }
			);
		} else if ( sectionsToUpdate.length === 1 ) {
			switch ( sectionsToUpdate[ 0 ] ) {
				case 'plugins':
					title = this.renderPluginsUpdate();
					break;

				case 'themes':
					title = this.renderThemesUpdate();
					break;

				case 'wordpress':
					title = this.renderWPComUpdate();
					break;
			}
		}

		return (
			<Notice
				ref="popoverJetpackNotifications"
				isCompact
				status="is-warning"
				icon="info-outline"
				onClick={ this.toggleJetpackNotificatonsPopover }
			>
				{ title }

				{ sectionsToUpdate.length > 1 &&
					<Popover
						className="current-site__jetpack-notifications-popover"
						id="popover__jetpack-notifications"
						isVisible={ showJetpackPopover }
						onClose={ this.hideJetpackNotificatonsPopover }
						position="right"
						context={ this.refs && this.refs.popoverJetpackNotifications }
					>
						{ this.renderWPComUpdate() }
						{ this.renderPluginsUpdate() }
						{ this.renderThemesUpdate() }
					</Popover>
				}
			</Notice>
		);
	},

	render() {
		const { site, sectionsToUpdate } = this.props;
		if ( ! site ) {
			return <div className="site__notices" />;
		}

		return (
			<div className={ classNames(
				'site__notices',
				{ 'has-many-updates': sectionsToUpdate.length > 1 }
			) }>

				<QuerySitePlans siteId={ site.ID } />
				<QuerySiteUpdates siteId={ site.ID } />

				{ this.getSiteRedirectNotice( site ) }
				{ this.domainCreditNotice() }
				{ this.jetpackPluginsSetupNotice() }
				{
					config.isEnabled( 'gm2016/jetpack-plugin-updates-trashpickup' ) &&
					this.renderJetpackNotifications()
				}
			</div>
		);
	}
} );

export default connect( ( state, ownProps ) => {
	const siteId = ownProps.site && ownProps.site.ID ? ownProps.site.ID : null;
	return {
		isJetpack: isJetpackSite( state, siteId ),
		hasDomainCredit: hasDomainCredit( state, siteId ),
		hasUpdates: siteHasUpdate( state, siteId ),
		hasWPUpdate: hasWordPressUpdate( state, siteId ),
		canManageOptions: canCurrentUser( state, siteId, 'manage_options' ),
		pausedJetpackPluginsSetup: ! isJetpackPluginsFinished( state, siteId ),
		updates: getUpdatesBySiteId( state, siteId ),
		sectionsToUpdate: getSectionsToUpdate( state, siteId ),
	};
}, ( dispatch ) => {
	return {
		clickClaimDomainNotice: () => dispatch( recordTracksEvent(
			'calypso_domain_credit_reminder_click', {
				cta_name: 'current_site_domain_notice'
			}
		) )
	};
} )( SiteNotice );
