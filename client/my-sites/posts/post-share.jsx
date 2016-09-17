/**
 * External dependencies
 */
import React, { PropTypes } from 'react';
import { connect } from 'react-redux';
import classNames from 'classnames';
import includes from 'lodash/includes';
import map from 'lodash/map';

/**
 * Internal dependencies
 */
import QueryPostTypes from 'components/data/query-post-types';
import Button from 'components/button';
import { getSelectedSiteId } from 'state/ui/selectors';
import { postTypeSupports } from 'state/post-types/selectors';
import { isJetpackModuleActive } from 'state/sites/selectors';
import { getCurrentUserId } from 'state/current-user/selectors';
import { getSiteUserConnections } from 'state/sharing/publicize/selectors';
import { fetchConnections as requestConnections, sharePost } from 'state/sharing/publicize/actions';

import serviceConnections from 'my-sites/sharing/connections/service-connections';
import FormCheckbox from 'components/forms/form-checkbox';
import PostMetadata from 'lib/post-metadata';
import PublicizeMessage from 'post-editor/editor-sharing/publicize-message'

const PostSharing = React.createClass( {
	propTypes: {
		site: PropTypes.object,
		post: PropTypes.object,
		siteId: PropTypes.number,
		isPublicizeEnabled: PropTypes.bool,
		connections: PropTypes.array,
		requestConnections: PropTypes.func
	},

	getInitialState() {
		return {
			skipped: PostMetadata.publicizeSkipped( this.props.post ) || [],
			message: PostMetadata.publicizeMessage( this.props.post )
		}
	},

	hasConnections: function() {
		return this.props.connections && this.props.connections.length;
	},

	toggleConnection: function ( id ) {
		const skipped = this.state.skipped.slice();
		const index = skipped.indexOf( id );
		if ( index !== -1 ) {
			skipped.splice( index, 1 );
		} else {
			skipped.push( id );
		}
		this.setState( { skipped } );
	},

	renderServices: function() {
		if ( ! this.props.site || ! this.hasConnections() ) {
			return;
		}
		const services = serviceConnections.getServicesFromConnections( this.props.connections );
		return services.map( function( service ) {
			const connections = serviceConnections.getConnectionsAvailableToCurrentUser(
				service.name,
				this.props.connections
			);
			return connections.map(
				connection => <li key={ connection.keyring_connection_ID }>
					<FormCheckbox
						checked={ ( this.state.skipped.indexOf( connection.keyring_connection_ID ) === -1 ) }
						onChange={ () => this.toggleConnection( connection.keyring_connection_ID ) } />
					<span>{ connection && connection.external_display }</span>
				</li>,
				this
			);
		}, this );
	},
	renderMessage: function() {
		const skipped = this.state.skipped;
		const targeted = this.hasConnections() ? this.props.connections.filter( function( connection ) {
				return skipped && -1 === skipped.indexOf( connection.keyring_connection_ID );
			} ) : [];
		const requireCount = includes( map( targeted, 'service' ), 'twitter' );
		const acceptableLength = ( requireCount ) ? 140 - 23 - 23 : null;

		if ( ! this.hasConnections() ) {
			return;
		}

		return (
			<PublicizeMessage
				message={ this.state.message }
				preview={ this.props.post.title }
				requireCount={ requireCount }
				onChange={ message => this.setState( { message } ) }
				acceptableLength={ acceptableLength } />
		);
	},
	render: function() {
		if ( ! this.props.isPublicizeEnabled ) {
			return null;
		}

		if ( this.props.site && this.props.site.options.publicize_permanently_disabled ) {
			return (
				<div className="editor-sharing__publicize-disabled">
					<p><span>{ this.translate( 'Publicize is disabled on this site.' ) }</span></p>
				</div>
			);
		}

		const classes = classNames( 'posts__post-share', {
			'has-connections': this.hasConnections()
		} );

		return (
			<div className={ classes }>
				{ this.props.siteId && <QueryPostTypes siteId={ this.props.siteId } /> }
				<h3 className="posts__post-share-title">
					{ this.translate( 'Share the post and spread the word!' ) }
				</h3>
				{ this.renderServices() }
				{ this.renderMessage() }
				<Button
					onClick={ () => this.props.sharePost( this.props.siteId, this.props.post.ID, this.state.skipped, '' ) }
					disabled={ ( ( this.props.connections.length || 0 ) > this.state.skipped.length ) }
				>
					{ this.translate( 'Share post again' ) }
				</Button>
			</div>
		);
	}
} );

export default connect(
	( state, props ) => {
		const siteId = getSelectedSiteId( state );
		const userId = getCurrentUserId( state );
		const postType = props.post.type;
		const isPublicizeEnabled = (
			false !== isJetpackModuleActive( state, siteId, 'publicize' ) &&
			postTypeSupports( state, siteId, postType, 'publicize' )
		);

		return {
			siteId,
			isPublicizeEnabled,
			connections: getSiteUserConnections( state, siteId, userId )
		};
	},
	{ requestConnections, sharePost }
)( PostSharing );
